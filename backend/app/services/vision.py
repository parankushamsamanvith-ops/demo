import io
import re
import json
import uuid
from datetime import date
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
import base64

from pydantic import BaseModel, Field
from PIL import Image
import pypdfium2 as pdfium
from openai import OpenAI
from google import genai
from google.genai import types

from app.core.config import settings
from app.core.security import encrypt_file_bytes, encrypt_field
from app.db.models import DocumentCategory


class DocumentMetadataExtraction(BaseModel):
    title: str = Field(description="Descriptive title of document")
    doc_type: str = Field(description="PASSPORT, NATIONAL_ID, DRIVING_LICENSE, VISA, TAX_RETURN, DEGREE, BIRTH_CERTIFICATE, OTHER")
    category: DocumentCategory = Field(description="High-level category enum")
    issuing_country: Optional[str] = Field(default=None, description="ISO 3166-1 alpha-3 code")
    document_number: Optional[str] = Field(default=None, description="Extracted document registration number")
    issue_date: Optional[date] = Field(default=None, description="Issue date in YYYY-MM-DD")
    expiry_date: Optional[date] = Field(default=None, description="Expiry date in YYYY-MM-DD")
    holder_name: Optional[str] = Field(default=None, description="Full name on document")
    additional_attributes: Dict[str, Any] = Field(default_factory=dict, description="Metadata key-value pairs")


def sanitize_sensitive_identifiers(doc_type: str, raw_id: Optional[str]) -> Optional[str]:
    """Applies strict redactions to Aadhaar, Korean RRN, and Japanese MyNumber."""
    if not raw_id:
        return None

    cleaned_digits = re.sub(r"\D", "", raw_id)

    if "AADHAAR" in doc_type.upper() or len(cleaned_digits) == 12:
        return "[Aadhaar Redacted]"

    if "RRN" in doc_type.upper() or (len(cleaned_digits) == 13 and re.match(r"^\d{6}[1-8]\d{6}$", cleaned_digits)):
        return "[RRN Omitted]"

    if "MYNUMBER" in doc_type.upper():
        return "[MyNumber Redacted]"

    return raw_id.strip()


class DocumentVisionService:
    def __init__(self):
        self.vault_path = Path(settings.STORAGE_VAULT_PATH)
        self.vault_path.mkdir(parents=True, exist_ok=True)
        self.openai_client = None
        self.gemini_client = None

        if settings.XAI_API_KEY:
            self.openai_client = OpenAI(api_key=settings.XAI_API_KEY, base_url=settings.XAI_BASE_URL)
        elif settings.GEMINI_API_KEY:
            try:
                self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            except Exception:
                self.gemini_client = None

    def _convert_bytes_to_images(self, file_bytes: bytes, mime_type: str) -> list[Image.Image]:
        images = []
        if mime_type == "application/pdf":
            pdf = pdfium.PdfDocument(file_bytes)
            num_pages = min(len(pdf), 3)
            for page_index in range(num_pages):
                page = pdf[page_index]
                images.append(page.render(scale=2.0).to_pil())
        elif mime_type.startswith("image/"):
            images.append(Image.open(io.BytesIO(file_bytes)).convert("RGB"))
        else:
            raise ValueError(f"Unsupported MIME type: {mime_type}")
        return images

    async def extract_and_classify(self, file_bytes: bytes, mime_type: str) -> DocumentMetadataExtraction:
        pil_images = self._convert_bytes_to_images(file_bytes, mime_type)
        if not pil_images:
            raise ValueError("File contains no readable images.")

        prompt = (
            "Analyze this document image. Identify doc_type (PASSPORT, NATIONAL_ID, VISA, TAX_RETURN, DEGREE), "
            "category (IDENTITY, TAXATION, TRAVEL, EDUCATION, CIVIL, OTHER), 3-letter issuing country code, "
            "dates in YYYY-MM-DD format, and document numbers. Never expose sensitive private identifiers."
        )

        if self.openai_client:
            buffered = io.BytesIO()
            pil_images[0].save(buffered, format="JPEG")
            img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
            res = self.openai_client.chat.completions.create(
                model="grok-2-vision-latest",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt + " Respond in JSON format."},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                        ]
                    }
                ],
                response_format={"type": "json_object"}
            )
            raw_content = res.choices[0].message.content
            extracted = DocumentMetadataExtraction.model_validate_json(raw_content)
        elif self.gemini_client:
            response = self.gemini_client.models.generate_content(
                model="gemini-3.6-flash",
                contents=[prompt] + pil_images,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=DocumentMetadataExtraction,
                    temperature=0.1,
                ),
            )
            extracted = DocumentMetadataExtraction.model_validate_json(response.text)
        else:
            raise ValueError("No AI vision API key configured (XAI_API_KEY or GEMINI_API_KEY required).")

        if extracted.document_number:
            extracted.document_number = sanitize_sensitive_identifiers(extracted.doc_type, extracted.document_number)

        return extracted

    def store_encrypted_document(self, user_id: str, file_bytes: bytes, original_filename: str) -> Tuple[str, int]:
        encrypted_bytes = encrypt_file_bytes(file_bytes)
        ext = Path(original_filename).suffix or ".bin"
        filename = f"{uuid.uuid4()}{ext}.enc"
        
        user_vault_dir = self.vault_path / str(user_id)
        user_vault_dir.mkdir(parents=True, exist_ok=True)

        file_path = user_vault_dir / filename
        file_path.write_bytes(encrypted_bytes)
        return f"{user_id}/{filename}", len(file_bytes)

    async def process_incoming_file(self, user_id: str, file_bytes: bytes, mime_type: str, original_filename: str) -> Dict[str, Any]:
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