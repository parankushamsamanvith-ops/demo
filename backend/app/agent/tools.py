import uuid
import json
from datetime import date
from typing import List, Dict, Any, Optional

from sqlalchemy import select, and_
from langchain_core.tools import tool

from app.db.session import async_session_factory
from app.db.models import Document, DocumentStatus, AuditLog
from app.core.security import decrypt_field
from app.services.rag_engine import rag_engine
from app.services.vision import sanitize_sensitive_identifiers


@tool
async def query_regulatory_knowledge_base(
    query: str,
    country_code: Optional[str] = None,
    category: Optional[str] = None,
) -> str:
    """
    Search official administrative rules, checklist mandates, and legal requirements
    stored in the vector database for a given country or category.
    """
    results = rag_engine.query_regulations(
        query=query,
        country_code=country_code,
        category=category,
        top_k=4,
        min_relevance=0.50,
    )
    if not results:
        return "No specific regulatory guidelines found in knowledge base."
    
    return rag_engine.format_retrieval_for_prompt(results)


@tool
async def inspect_user_document_vault(
    user_id: str,
    required_types: List[str],
) -> List[Dict[str, Any]]:
    """
    Scans the user's database records to check if required documents exist,
    evaluating their active validity, expiration dates, and readiness.
    Safely redacts restricted identity numbers.
    """
    user_id_str = str(user_id)
    today = date.today()
    normalized_types = [t.strip().upper() for t in required_types if t and t.strip()]

    checklist_results = []

    async with async_session_factory() as session:
        stmt = select(Document).where(
            and_(
                Document.user_id == user_id_str,
                Document.status != DocumentStatus.EXPIRED,
            )
        )
        res = await session.execute(stmt)
        user_docs = res.scalars().all()

        # If no specific required document types were requested, return the full inventory of user's active documents
        if not normalized_types:
            for doc in user_docs:
                expiry = doc.expiry_date
                status_str = "AVAILABLE"
                notes = f"{doc.title} is uploaded and active in your vault."

                if expiry:
                    days_left = (expiry - today).days
                    if days_left <= 0:
                        status_str = "EXPIRED"
                        notes = f"{doc.title} expired on {expiry.isoformat()}. Must be renewed."
                    elif days_left <= 90:
                        status_str = "EXPIRING_SOON"
                        notes = f"{doc.title} expires in {days_left} days ({expiry.isoformat()}). Renewal recommended."

                checklist_results.append({
                    "doc_type": doc.doc_type.upper(),
                    "status": status_str,
                    "doc_id": str(doc.id),
                    "title": doc.title,
                    "expiry_date": expiry.isoformat() if expiry else None,
                    "notes": notes,
                })
            return checklist_results

        # Build lookup table by normalized doc_type
        docs_by_type: Dict[str, Document] = {}
        for d in user_docs:
            d_type = d.doc_type.upper()
            if d_type not in docs_by_type:
                docs_by_type[d_type] = d

        for req in normalized_types:
            # Check for direct match or flexible alias matching
            matched_doc = None
            for stored_type, doc in docs_by_type.items():
                if req in stored_type or stored_type in req:
                    matched_doc = doc
                    break

            if not matched_doc:
                checklist_results.append({
                    "doc_type": req,
                    "status": "MISSING",
                    "doc_id": None,
                    "title": None,
                    "expiry_date": None,
                    "notes": "Not found in user vault.",
                })
                continue

            # Evaluate expiration boundaries
            expiry = matched_doc.expiry_date
            status_str = "AVAILABLE"
            notes = f"{matched_doc.title} ready for submission."

            if expiry:
                days_left = (expiry - today).days
                if days_left <= 0:
                    status_str = "EXPIRED"
                    notes = f"{matched_doc.title} expired on {expiry.isoformat()}. Must be renewed."
                elif days_left <= 90:
                    status_str = "EXPIRING_SOON"
                    notes = f"{matched_doc.title} expires in {days_left} days ({expiry.isoformat()}). Renewal recommended."

            checklist_results.append({
                "doc_type": req,
                "status": status_str,
                "doc_id": str(matched_doc.id),
                "title": matched_doc.title,
                "expiry_date": expiry.isoformat() if expiry else None,
                "notes": notes,
            })

    return checklist_results


@tool
async def retrieve_document_data_for_form(
    user_id: str,
    doc_id: str,
) -> Dict[str, Any]:
    """
    Safely decrypts metadata for a specific document to assist in form filling.
    Never exposes raw Aadhaar, RRN, or MyNumber digits under any circumstances.
    """
    user_id_str = str(user_id)
    doc_id_str = str(doc_id)

    async with async_session_factory() as session:
        stmt = select(Document).where(
            and_(
                Document.id == doc_id_str,
                Document.user_id == user_id_str,
            )
        )
        res = await session.execute(stmt)
        doc = res.scalar_one_or_none()

        if not doc:
            return {"error": "Document not found or unauthorized access."}

        # Decrypt fields
        decrypted_number = decrypt_field(doc.encrypted_doc_number) if doc.encrypted_doc_number else None
        
        # Enforce strict zero-disclosure masking on forbidden IDs
        safe_number = sanitize_sensitive_identifiers(doc.doc_type, decrypted_number)
        if safe_number and safe_number.startswith("[") and safe_number.endswith("]"):
            # Ensure it is clearly represented as a redaction placeholder
            safe_number = f"{safe_number} (Protected identifier)"

        metadata_dict = {}
        if doc.encrypted_metadata:
            try:
                metadata_dict = json.loads(decrypt_field(doc.encrypted_metadata))
            except Exception:
                metadata_dict = {}

        return {
            "title": doc.title,
            "doc_type": doc.doc_type,
            "category": doc.category.value,
            "issuing_country": doc.issuing_country,
            "document_number": safe_number,
            "issue_date": doc.issue_date.isoformat() if doc.issue_date else None,
            "expiry_date": doc.expiry_date.isoformat() if doc.expiry_date else None,
            "additional_attributes": metadata_dict,
        }