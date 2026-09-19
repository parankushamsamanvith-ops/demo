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
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class DocumentCategory(str, Enum):
    IDENTITY = "IDENTITY"
    TAXATION = "TAXATION"
    TRAVEL = "TRAVEL"
    EDUCATION = "EDUCATION"
    CIVIL = "CIVIL"
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

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
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

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    tasks = relationship("BureaucraticTask", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    doc_type = Column(String(100), nullable=False, index=True)
    category = Column(SQLEnum(DocumentCategory), nullable=False, index=True)
    issuing_country = Column(String(3), nullable=True)

    encrypted_doc_number = Column(Text, nullable=True)
    encrypted_metadata = Column(Text, nullable=True)

    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True, index=True)

    storage_path = Column(String(512), nullable=False)
    file_mime_type = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False, default=0)

    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.ACTIVE, nullable=False, index=True)
    last_reminder_sent = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    owner = relationship("User", back_populates="documents")


class BureaucraticTask(Base):
    __tablename__ = "bureaucratic_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    task_name = Column(String(255), nullable=False)
    target_country = Column(String(3), nullable=True)
    deadline = Column(Date, nullable=True)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.NOT_STARTED, nullable=False)

    checklist_state = Column(JSON, default=list, nullable=False)
    step_history = Column(JSON, default=list, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="tasks")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", back_populates="audit_logs")