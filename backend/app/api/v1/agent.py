import json
import uuid
from typing import AsyncGenerator, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import HumanMessage

from app.db.session import async_session_factory
from app.db.models import BureaucraticTask, TaskStatus, AuditLog
from app.agent.graph import bureaucracy_agent_app
from app.agent.state import AgentState
from app.api.v1.documents import get_current_user_id, get_db_session

router = APIRouter(prefix="/agent", tags=["Agentic Workflow"])


# ==============================================================================
# Request & Response Schemas
# ==============================================================================

class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, description="The user's query or procedural goal")
    task_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional existing task ID to continue an ongoing application checklist",
    )


class TaskResponse(BaseModel):
    id: uuid.UUID
    task_name: str
    target_country: Optional[str]
    status: TaskStatus
    checklist_state: List[dict]

    class Config:
        from_attributes = True


# ==============================================================================
# Streaming Execution Engine
# ==============================================================================

async def run_agent_stream(
    user_id: str,
    user_message: str,
    task_id: Optional[uuid.UUID],
) -> AsyncGenerator[str, None]:
    """
    Executes the LangGraph compiled state machine and yields real-time SSE events
    for each transition: Intent Parsing -> RAG Retrieval -> Vault Check -> Final Guidance.
    """
    initial_state: AgentState = {
        "messages": [HumanMessage(content=user_message)],
        "user_id": str(user_id),
        "active_task_id": str(task_id) if task_id else None,
        "target_country": None,
        "procedure_topic": None,
        "procedure_category": None,
        "retrieved_rules": [],
        "required_docs": [],
        "document_checklist": [],
        "missing_docs": [],
        "is_complete": False,
        "requires_user_action": False,
        "next_step_instruction": None,
    }

    final_checklist = []
    task_name_detected = "Bureaucratic Inquiry"
    target_country_detected = None

    try:
        async for output in bureaucracy_agent_app.astream(initial_state):
            for node_name, node_state in output.items():
                # Emit structured telemetry event for the UI
                event_payload = {
                    "event": "node_update",
                    "node": node_name,
                }

                if node_name == "parse_intent":
                    task_name_detected = node_state.get("procedure_topic") or task_name_detected
                    target_country_detected = node_state.get("target_country")
                    event_payload["data"] = {
                        "procedure_topic": task_name_detected,
                        "target_country": target_country_detected,
                    }

                elif node_name == "retrieve_rules":
                    event_payload["data"] = {
                        "required_docs": node_state.get("required_docs", []),
                    }

                elif node_name == "audit_vault":
                    checklist_raw = [
                        item.model_dump() if hasattr(item, "model_dump") else dict(item)
                        for item in node_state.get("document_checklist", [])
                    ]
                    final_checklist = checklist_raw
                    event_payload["data"] = {
                        "checklist": checklist_raw,
                        "missing_docs": node_state.get("missing_docs", []),
                        "is_complete": node_state.get("is_complete", False),
                    }

                elif node_name == "synthesize_guidance":
                    event_payload["data"] = {
                        "answer": node_state.get("next_step_instruction", ""),
                    }

                # Yield SSE format
                yield f"data: {json.dumps(event_payload)}\n\n"
    except Exception as exc:
        error_payload = {
            "event": "node_update",
            "node": "synthesize_guidance",
            "data": {
                "answer": f"An error occurred while processing your request: {str(exc)}",
            },
        }
        yield f"data: {json.dumps(error_payload)}\n\n"
        yield "data: [DONE]\n\n"
        return

    # Save or update task state in database
    try:
        async with async_session_factory() as db:
            user_id_str = str(user_id)
            if task_id:
                stmt = select(BureaucraticTask).where(
                    and_(BureaucraticTask.id == str(task_id), BureaucraticTask.user_id == user_id_str)
                )
                res = await db.execute(stmt)
                task = res.scalar_one_or_none()
                if task:
                    task.checklist_state = final_checklist
                    task.status = (
                        TaskStatus.READY_TO_SUBMIT
                        if len([i for i in final_checklist if i.get("status") in ["MISSING", "EXPIRED"]]) == 0
                        else TaskStatus.WAITING_DOCUMENTS
                    )
                    await db.commit()
            else:
                new_task = BureaucraticTask(
                    user_id=user_id_str,
                    task_name=task_name_detected,
                    target_country=target_country_detected,
                    status=(
                        TaskStatus.READY_TO_SUBMIT
                        if len([i for i in final_checklist if i.get("status") in ["MISSING", "EXPIRED"]]) == 0
                        else TaskStatus.WAITING_DOCUMENTS
                    ),
                    checklist_state=final_checklist,
                )
                db.add(new_task)
                await db.commit()
                await db.refresh(new_task)
                yield f"data: {json.dumps({'event': 'task_created', 'task_id': str(new_task.id)})}\n\n"
    except Exception as db_exc:
        pass

    yield "data: [DONE]\n\n"


# ==============================================================================
# API Endpoints
# ==============================================================================

@router.post("/chat")
async def chat_with_agent(
    payload: ChatMessageRequest,
    user_id: str = Depends(get_current_user_id),
):
    """
    Submits a user query and returns a live Server-Sent Events (SSE) stream
    reflecting each transition and the final response.
    """
    return StreamingResponse(
        run_agent_stream(
            user_id=user_id,
            user_message=payload.message,
            task_id=payload.task_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        },
    )


@router.get("/tasks", response_model=List[TaskResponse])
async def list_active_tasks(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieves all tracked bureaucratic applications, checklists, and submission statuses."""
    stmt = select(BureaucraticTask).where(BureaucraticTask.user_id == str(user_id)).order_by(BureaucraticTask.created_at.desc())
    res = await db.execute(stmt)
    tasks = res.scalars().all()
    return tasks