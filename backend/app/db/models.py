import uuid
from datetime import datetime, date, timezone
from enum import Enum
from typing import Optional, List
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Date,
    ForeignKey,
    Text,
    Integer,
    Enum as SQLEnum,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class DocumentCategory(str, Enum):
    IDENTITY = "IDENTITY"               # Passports, National IDs, Driving Licenses
    TAXATION = "TAXATION"               # Tax returns, PAN/SSN equivalents, Salary slips
    TRAVEL = "TRAVEL"                   # Visas, Entry permits, Travel Insurance
    EDUCATION = "EDUCATION"             # Degrees, Transcripts, Language certifications
    CIVIL = "CIVIL"                     # Birth, Marriage, Police clearance certificates
    OTHER = "OTHER"


class DocumentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRING_SOON = "EXPIRING_SOON"
    EXPIRED = "EXPIRED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"


class TaskStatus(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    WAITING_DOCUMENTS = "WAITING_DOCUMENTS"
    READY_TO_SUBMIT = "READY_TO_SUBMIT"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    tasks = relationship("BureaucraticTask", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Metadata
    title = Column(String(255), nullable=False)                         # e.g., "Primary Passport"
    doc_type = Column(String(100), nullable=False, index=True)          # e.g., "PASSPORT", "DRIVING_LICENSE"
    category = Column(SQLEnum(DocumentCategory), nullable=False, index=True)
    issuing_country = Column(String(3), nullable=True)                  # ISO 3166-1 alpha-3 (e.g., "IND", "USA")
    
    # Encrypted fields for data protection (AES-256-GCM string payloads)
    encrypted_doc_number = Column(Text, nullable=True)                  # Raw ID/Document number
    encrypted_metadata = Column(Text, nullable=True)                    # Additional extracted JSON metadata
    
    # Exact dates for expiration tracking
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True, index=True)
    
    # File Vault references
    storage_path = Column(String(512), nullable=False)                  # Relative path inside encrypted vault
    file_mime_type = Column(String(100), nullable=False)                # e.g., "application/pdf", "image/jpeg"
    file_size_bytes = Column(Integer, nullable=False, default=0)
    
    # State tracking
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.ACTIVE, nullable=False, index=True)
    last_reminder_sent = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    owner = relationship("User", back_populates="documents")


class BureaucraticTask(Base):
    __tablename__ = "bureaucratic_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    task_name = Column(String(255), nullable=False)                     # e.g., "German Student Visa Application"
    target_country = Column(String(3), nullable=True)                   # ISO alpha-3
    deadline = Column(Date, nullable=True)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.NOT_STARTED, nullable=False)
    
    # Progress & Checklist State
    # Example: [{"doc_type": "PASSPORT", "status": "AVAILABLE", "doc_id": "uuid..."}, {"doc_type": "TAX_RETURNS", "status": "MISSING"}]
    checklist_state = Column(JSON, default=list, nullable=False)
    step_history = Column(JSON, default=list, nullable=False)          # Process execution events for event log mining

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="tasks")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(100), nullable=False)                        # e.g., "DOCUMENT_DECRYPT", "EXPIRATION_ALERT"
    resource_type = Column(String(50), nullable=False)                  # e.g., "DOCUMENT", "TASK"
    resource_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="audit_logs")