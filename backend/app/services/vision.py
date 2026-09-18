import io
import os
import re
import json
import uuid
from datetime import date, datetime
from typing import Optional, Dict, Any, Tuple
from pathlib import Path

from pydantic import BaseModel, Field
from PIL import Image
import pypdfium2 as pdfium
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.security import encrypt_file_bytes, encrypt_field
from app.db.models import DocumentCategory


# ==============================================================================
# Pydantic Extraction Schemas
# ==============================================================================

class DocumentMetadataExtraction(BaseModel):
    title: str = Field(
        description="A concise descriptive name for the document (e.g., 'Primary Passport', 'Q4 Tax Statement')"
    )
    doc_type: str = Field(
        description="Standardized machine type: PASSPORT, NATIONAL_ID, DRIVING_LICENSE, VISA, TAX_RETURN, DEGREE, BIRTH_CERTIFICATE, OTHER"
    )
    category: DocumentCategory = Field(
        description="High-level category corresponding to the system DocumentCategory enum"
    )
    issuing_country: Optional[str] = Field(
        default=None,
        description="ISO 3166-1 alpha-3 code of issuing nation (e.g., IND, USA, DEU, GBR)"
    )
    document_number: Optional[str] = Field(
        default=None,
        description="Extracted document identifier or registration number"
    )
    issue_date: Optional[date] = Field(
        default=None,
        description="Official issue date in YYYY-MM-DD format, if detected"
    )
    expiry_date: Optional[date] = Field(
        default=None,
        description="Official expiration date in YYYY-MM-DD format, if detected"
    )
    holder_name: Optional[str] = Field(
        default=None,
        description="Full name of document holder as stated on the file"
    )
    additional_attributes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Key-value pairs of auxiliary information (e.g., place of birth, issuing authority, blood group)"
    )


# ==============================================================================
# Sensitive ID Redaction Guardrails
# ==============================================================================

def sanitize_sensitive_identifiers(doc_type: str, raw_id: Optional[str]) -> Optional[str]:
    """
    Enforces zero-disclosure safeguards on high-risk national identity numbers
    (e.g., Aadhaar 12-digit numbers, RRN, MyNumber) to prevent plaintext retention
    or leakage in downstream outputs.
    """
    if not raw_id:
        return None

    cleaned_digits = re.sub(r"\D", "", raw_id)

    # India Aadhaar check (12 digits)
    if "AADHAAR" in doc_type.upper() or len(cleaned_digits) == 12:
        return "[AADHAAR_REDACTED_SECURE]"

    # Korea Resident Registration Number (13 digits: 6 date + 7 identifier)
    if "RRN" in doc_type.upper() or (len(cleaned_digits) == 13 and re.match(r"^\d{6}[1-8]\d{6}$", cleaned_digits)):
        return "[RRN_REDACTED_SECURE]"

    # Japan MyNumber (12 digits)
    if "MYNUMBER" in doc_type.upper():
        return "[MYNUMBER_REDACTED_SECURE]"

    return raw_id.strip()


# ==============================================================================
# Document Vision Ingestion Engine
# ==============================================================================

class DocumentVisionService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.vault_path = Path(settings.STORAGE_VAULT_PATH)
        self.vault_path.mkdir(parents=True, exist_ok=True)

    def _convert_bytes_to_images(self, file_bytes: bytes, mime_type: str) -> list[Image.Image]:
        """Converts image files or PDF documents into PIL Image objects for multimodal intake."""
        images = []
        if mime_type == "application/pdf":
            pdf = pdfium.PdfDocument(file_bytes)
            # Process up to first 3 pages for classification and OCR
            num_pages = min(len(pdf), 3)
            for page_index in range(num_pages):
                page = pdf[page_index]
                pil_image = page.render(scale=2.0).to_pil()
                images.append(pil_image)
        elif mime_type.startswith("image/"):
            img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            images.append(img)
        else:
            raise ValueError(f"Unsupported MIME type for vision ingestion: {mime_type}")
        
        return images

    async def extract_and_classify(self, file_bytes: bytes, mime_type: str) -> DocumentMetadataExtraction:
        """
        Executes zero-shot OCR and structured entity extraction via Gemini multimodal models.
        """
        pil_images = self._convert_bytes_to_images(file_bytes, mime_type)
        if not pil_images:
            raise ValueError("File contains no readable image pages.")

        prompt = (
            "You are an expert bureaucratic compliance auditor. Inspect the attached document image(s).\n"
            "Analyze the typography, seals, layouts, and text to perform OCR and exact field extraction.\n"
            "Rules:\n"
            "1. Accurately identify doc_type (e.g., PASSPORT, NATIONAL_ID, DRIVING_LICENSE, VISA, TAX_RETURN, DEGREE).\n"
            "2. Map category correctly (IDENTITY, TAXATION, TRAVEL, EDUCATION, CIVIL, OTHER).\n"
            "3. Extract issue_date and expiry_date strictly in YYYY-MM-DD format if present.\n"
            "4. Extract issuing nation as a 3-letter ISO code.\n"
            "5. If dates or IDs are partially obscured or missing, leave them as null."
        )

        contents = [prompt] + pil_images

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DocumentMetadataExtraction,
                temperature=0.1,
            ),
        )

        extracted_data = DocumentMetadataExtraction.model_validate_json(response.text)

        # Apply identity protection filters
        if extracted_data.document_number:
            extracted_data.document_number = sanitize_sensitive_identifiers(
                extracted_data.doc_type, extracted_data.document_number
            )

        return extracted_data

    def store_encrypted_document(
        self, user_id: uuid.UUID, file_bytes: bytes, original_filename: str
    ) -> Tuple[str, int]:
        """
        Encrypts raw binary file with AES-256-GCM and persists it inside the secure vault.
        Returns: (relative_storage_path, file_size_bytes)
        """
        encrypted_bytes = encrypt_file_bytes(file_bytes)
        extension = Path(original_filename).suffix or ".bin"
        filename = f"{uuid.uuid4()}{extension}.enc"
        
        user_vault_dir = self.vault_path / str(user_id)
        user_vault_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = user_vault_dir / filename
        file_path.write_bytes(encrypted_bytes)

        relative_path = f"{user_id}/{filename}"
        return relative_path, len(file_bytes)

    async def process_incoming_file(
        self, user_id: uuid.UUID, file_bytes: bytes, mime_type: str, original_filename: str
    ) -> Dict[str, Any]:
        """
        Unified ingestion pipeline:
        1. Encrypts and writes raw file to the storage vault.
        2. Executes OCR and metadata extraction with Gemini 2.5 Flash.
        3. Prepares encrypted database attributes.
        """
        storage_path, file_size = self.store_encrypted_document(user_id, file_bytes, original_filename)
        extraction = await self.extract_and_classify(file_bytes, mime_type)

        encrypted_doc_num = encrypt_field(extraction.document_number) if extraction.document_number else None
        encrypted_meta = encrypt_field(json.dumps(extraction.additional_attributes))

        return {
            "title": extraction.title or original_filename,
            "doc_type": extraction.doc_type,
            "category": extraction.category,
            "issuing_country": extraction.issuing_country,
            "encrypted_doc_number": encrypted_doc_num,
            "encrypted_metadata": encrypted_meta,
            "issue_date": extraction.issue_date,
            "expiry_date": extraction.expiry_date,
            "storage_path": storage_path,
            "file_mime_type": mime_type,
            "file_size_bytes": file_size,
        }


vision_service = DocumentVisionService()