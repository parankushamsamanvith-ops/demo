import uuid
from typing import List, Dict, Any, Optional, Annotated
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field


class DocumentCheckItem(BaseModel):
    doc_type: str = Field(description="Normalized document type: PASSPORT, NATIONAL_ID, TAX_RETURN, etc.")
    title: Optional[str] = Field(default=None, description="Title of the matched document in vault")
    status: str = Field(description="AVAILABLE, EXPIRING_SOON, EXPIRED, or MISSING")
    doc_id: Optional[str] = Field(default=None, description="Database UUID string of the matched document")
    expiry_date: Optional[str] = Field(default=None, description="ISO formatted expiration date")
    notes: Optional[str] = Field(default=None, description="Contextual alerts (e.g., validity period warnings)")


class AgentState(TypedDict):
    # Chat conversation history with append reducer
    messages: Annotated[List[BaseMessage], add_messages]
    
    # User Context & Session
    user_id: str
    active_task_id: Optional[str]
    
    # Process Extraction
    target_country: Optional[str]      # ISO 3166-1 alpha-3 code (e.g., DEU, IND, USA)
    procedure_topic: Optional[str]     # e.g., "Schengen Visa Type C", "Passport Renewal"
    procedure_category: Optional[str]  # VISA, TAXATION, IDENTITY, EDUCATION
    
    # RAG Grounding Context
    retrieved_rules: List[Dict[str, Any]]
    
    # Vault Evaluation State
    required_docs: List[str]
    document_checklist: List[DocumentCheckItem]
    missing_docs: List[str]
    
    # State flags
    is_complete: bool
    requires_user_action: bool
    next_step_instruction: Optional[str]