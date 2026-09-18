import uuid
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.db.models import Document, DocumentCategory, DocumentStatus, AuditLog, User
from app.core.security import decrypt_field
from app.services.vision import vision_service, sanitize_sensitive_identifiers

router = APIRouter(prefix="/documents", tags=["Documents"])


# ==============================================================================
# Request & Response Schemas
# ==============================================================================

class DocumentResponse(BaseModel):
    id: uuid.UUID
    title: str
    doc_type: str
    category: DocumentCategory
    issuing_country: Optional[str]
    document_number: Optional[str]
    issue_date: Optional[date]
    expiry_date: Optional[date]
    status: DocumentStatus
    file_mime_type: str
    file_size_bytes: int

    class Config:
        from_attributes = True


# ==============================================================================
# Dependency: Mock/Extracted Authenticated User
# ==============================================================================

async def get_current_user_id() -> uuid.UUID:
    """
    Dependency returning the verified user's UUID from JWT session context.
    Using a deterministic fallback UUID for local testing.
    """
    return uuid.UUID("11111111-1111-1111-1111-111111111111")


async def get_db_session():
    async with async_session_factory() as session:
        yield session


# ==============================================================================
# API Endpoints
# ==============================================================================

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Uploads a PDF or image, runs multimodal entity extraction,
    encrypts the payload using AES-256-GCM, and persists metadata in PostgreSQL.
    """
    allowed_mimes = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{file.content_type}'. Must be PDF, JPEG, PNG, or WEBP.",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    try:
        # Run OCR, Classification, and Encryption via Vision Service
        processed_data = await vision_service.process_incoming_file(
            user_id=user_id,
            file_bytes=file_bytes,
            mime_type=file.content_type,
            original_filename=file.filename or "uploaded_document",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(exc)}",
        )

    new_doc = Document(
        user_id=user_id,
        title=processed_data["title"],
        doc_type=processed_data["doc_type"],
        category=processed_data["category"],
        issuing_country=processed_data["issuing_country"],
        encrypted_doc_number=processed_data["encrypted_doc_number"],
        encrypted_metadata=processed_data["encrypted_metadata"],
        issue_date=processed_data["issue_date"],
        expiry_date=processed_data["expiry_date"],
        storage_path=processed_data["storage_path"],
        file_mime_type=processed_data["file_mime_type"],
        file_size_bytes=processed_data["file_size_bytes"],
        status=DocumentStatus.ACTIVE,
    )

    db.add(new_doc)
    
    # Write Audit Trail
    audit = AuditLog(
        user_id=user_id,
        action="DOCUMENT_UPLOADED",
        resource_type="DOCUMENT",
        resource_id=str(new_doc.id),
    )
    db.add(audit)
    await db.commit()
    await db.refresh(new_doc)

    # Decrypt number for immediate response, ensuring protected IDs remain redacted
    decrypted_num = decrypt_field(new_doc.encrypted_doc_number) if new_doc.encrypted_doc_number else None
    safe_number = sanitize_sensitive_identifiers(new_doc.doc_type, decrypted_num)

    return DocumentResponse(
        id=new_doc.id,
        title=new_doc.title,
        doc_type=new_doc.doc_type,
        category=new_doc.category,
        issuing_country=new_doc.issuing_country,
        document_number=safe_number,
        issue_date=new_doc.issue_date,
        expiry_date=new_doc.expiry_date,
        status=new_doc.status,
        file_mime_type=new_doc.file_mime_type,
        file_size_bytes=new_doc.file_size_bytes,
    )


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
):
    """Lists all active and expiring documents in the user's secure vault."""
    stmt = select(Document).where(Document.user_id == user_id).order_by(Document.created_at.desc())
    res = await db.execute(stmt)
    docs = res.scalars().all()

    response_list = []
    for doc in docs:
        decrypted_num = decrypt_field(doc.encrypted_doc_number) if doc.encrypted_doc_number else None
        safe_number = sanitize_sensitive_identifiers(doc.doc_type, decrypted_num)
        
        response_list.append(
            DocumentResponse(
                id=doc.id,
                title=doc.title,
                doc_type=doc.doc_type,
                category=doc.category,
                issuing_country=doc.issuing_country,
                document_number=safe_number,
                issue_date=doc.issue_date,
                expiry_date=doc.expiry_date,
                status=doc.status,
                file_mime_type=doc.file_mime_type,
                file_size_bytes=doc.file_size_bytes,
            )
        )

    return response_list


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
):
    """Deletes document record and records compliance audit trail."""
    stmt = select(Document).where(and_(Document.id == document_id, Document.user_id == user_id))
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    await db.delete(doc)
    audit = AuditLog(
        user_id=user_id,
        action="DOCUMENT_DELETED",
        resource_type="DOCUMENT",
        resource_id=str(document_id),
    )
    db.add(audit)
    await db.commit()
    return None