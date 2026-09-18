import os
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer
from pydantic import BaseModel, Field

from app.core.config import settings


# ==============================================================================
# Data Transfer Models
# ==============================================================================

class RuleChunk(BaseModel):
    chunk_id: str
    content: str
    country_code: str = Field(description="ISO 3166-1 alpha-3 code, or 'GLOBAL'")
    category: str = Field(description="e.g., VISA, TAX, PASSPORT, HIGHER_EDUCATION")
    topic: str = Field(description="Specific process name, e.g., 'Schengen Visa Type C'")
    required_docs: List[str] = Field(default_factory=list, description="Mandatory documents cited in chunk")
    source_reference: str = Field(description="Official manual URL or ordinance citation")


class SearchResult(BaseModel):
    content: str
    score: float
    country_code: str
    category: str
    topic: str
    required_docs: List[str]
    source_reference: str


# ==============================================================================
# Recursive Text Splitter (Token-Aware Chunking for Bureaucratic Documents)
# ==============================================================================

class RecursiveTextSplitter:
    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", ". ", "; ", " "]

    def split_text(self, text: str) -> List[str]:
        """Recursively splits dense administrative text while preserving semantic boundaries."""
        if len(text) <= self.chunk_size:
            return [text.strip()] if text.strip() else []

        chunks: List[str] = []
        current_sep = self.separators[-1]
        for sep in self.separators:
            if sep in text:
                current_sep = sep
                break

        splits = text.split(current_sep)
        buffer = ""

        for part in splits:
            candidate = f"{buffer}{current_sep}{part}" if buffer else part
            if len(candidate) <= self.chunk_size:
                buffer = candidate
            else:
                if buffer:
                    chunks.append(buffer.strip())
                # Handle oversized segments by recursing further down separators
                if len(part) > self.chunk_size and self.separators.index(current_sep) < len(self.separators) - 1:
                    sub_splitter = RecursiveTextSplitter(
                        chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap
                    )
                    chunks.extend(sub_splitter.split_text(part))
                    buffer = ""
                else:
                    # Retain sliding window overlap
                    overlap_idx = max(0, len(buffer) - self.chunk_overlap)
                    buffer = buffer[overlap_idx:] + current_sep + part if buffer else part

        if buffer.strip():
            chunks.append(buffer.strip())

        return chunks


# ==============================================================================
# RAG Knowledge Engine
# ==============================================================================

class BureaucracyRAGEngine:
    COLLECTION_NAME = "bureaucratic_regulations"

    def __init__(self):
        # 1. Initialize persistent vector storage directory
        persist_dir = Path(settings.CHROMA_PERSIST_DIR)
        persist_dir.mkdir(parents=True, exist_ok=True)

        self.chroma_client = chromadb.PersistentClient(
            path=str(persist_dir),
            settings=ChromaSettings(allow_reset=True, anonymized_telemetry=False),
        )

        # 2. Load dense embedding model
        self.encoder = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)

        # 3. Retrieve or create collection using cosine similarity metric
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def index_regulatory_document(
        self,
        raw_text: str,
        country_code: str,
        category: str,
        topic: str,
        source_reference: str,
        required_docs: Optional[List[str]] = None,
    ) -> int:
        """
        Splits, embeds, and indexes an official administrative manual or government policy guideline.
        Returns the count of successfully indexed vectors.
        """
        splitter = RecursiveTextSplitter(chunk_size=550, chunk_overlap=80)
        chunks = splitter.split_text(raw_text)
        if not chunks:
            return 0

        embeddings = self.encoder.encode(chunks, normalize_embeddings=True).tolist()
        doc_tag_str = ",".join(required_docs) if required_docs else ""

        ids = [f"{country_code}_{category}_{uuid.uuid4().hex[:8]}" for _ in chunks]
        metadatas = [
            {
                "country_code": country_code.upper(),
                "category": category.upper(),
                "topic": topic,
                "required_docs": doc_tag_str,
                "source_reference": source_reference,
            }
            for _ in chunks
        ]

        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
        )
        return len(chunks)

    def query_regulations(
        self,
        query: str,
        country_code: Optional[str] = None,
        category: Optional[str] = None,
        top_k: int = 4,
        min_relevance: float = 0.55,
    ) -> List[SearchResult]:
        """
        Executes dense semantic retrieval with optional country/category pre-filtering.
        Filters out low-confidence hallucinations using cosine similarity threshold.
        """
        query_vector = self.encoder.encode([query], normalize_embeddings=True).tolist()[0]

        # Construct metadata filters if provided
        where_conditions: Dict[str, Any] = {}
        if country_code and category:
            where_conditions = {
                "$and": [
                    {"country_code": country_code.upper()},
                    {"category": category.upper()},
                ]
            }
        elif country_code:
            where_conditions = {"country_code": country_code.upper()}
        elif category:
            where_conditions = {"category": category.upper()}

        query_args = {
            "query_embeddings": [query_vector],
            "n_results": top_k,
        }
        if where_conditions:
            query_args["where"] = where_conditions

        results = self.collection.query(**query_args)

        retrieved_results: List[SearchResult] = []
        if not results["documents"] or not results["documents"][0]:
            return retrieved_results

        docs = results["documents"][0]
        distances = results["distances"][0] if results.get("distances") else [0.0] * len(docs)
        metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)

        for text, dist, meta in zip(docs, distances, metas):
            # ChromaDB cosine distance: distance = 1 - cosine_similarity
            similarity_score = 1.0 - dist
            if similarity_score < min_relevance:
                continue

            raw_docs_tag = meta.get("required_docs", "")
            doc_list = [d.strip() for d in raw_docs_tag.split(",") if d.strip()]

            retrieved_results.append(
                SearchResult(
                    content=text,
                    score=round(similarity_score, 4),
                    country_code=meta.get("country_code", "GLOBAL"),
                    category=meta.get("category", "OTHER"),
                    topic=meta.get("topic", "General"),
                    required_docs=doc_list,
                    source_reference=meta.get("source_reference", "Internal Guidelines"),
                )
            )

        return retrieved_results

    def format_retrieval_for_prompt(self, results: List[SearchResult]) -> str:
        """Serializes retrieved policy excerpts into an isolated grounding context for the agent."""
        if not results:
            return "No specific regulatory guidelines found in the knowledge base."

        formatted_blocks = []
        for idx, res in enumerate(results, 1):
            req_str = ", ".join(res.required_docs) if res.required_docs else "None specified"
            block = (
                f"--- Policy Excerpt #{idx} ---\n"
                f"Jurisdiction: {res.country_code} | Category: {res.category} | Topic: {res.topic}\n"
                f"Mandatory Documents: {req_str}\n"
                f"Source: {res.source_reference}\n"
                f"Rule Details: {res.content}\n"
            )
            formatted_blocks.append(block)

        return "\n".join(formatted_blocks)


rag_engine = BureaucracyRAGEngine()