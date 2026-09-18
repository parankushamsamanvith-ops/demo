from typing import Literal
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END

from app.core.config import settings
from app.agent.state import AgentState, DocumentCheckItem
from app.agent.tools import (
    query_regulatory_knowledge_base,
    inspect_user_document_vault,
    retrieve_document_data_for_form,
)

# Initialize Google GenAI Chat Model
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.1,
)


# ==============================================================================
# Node 1: Intent & Jurisdiction Clarification
# ==============================================================================

async def parse_intent_node(state: AgentState) -> dict:
    """Extracts target jurisdiction, category, and specific procedure from conversation."""
    messages = state["messages"]
    system_prompt = (
        "You are an analytical bureaucratic assistant. Determine the user's intended "
        "bureaucratic task, the relevant ISO 3-letter country code (e.g., DEU, IND, USA, GBR), "
        "and broad category (VISA, TAXATION, IDENTITY, EDUCATION, CIVIL, OTHER).\n"
        "Respond in strictly formatted JSON: "
        '{"country_code": "...", "procedure_topic": "...", "procedure_category": "..."}'
    )
    
    response = await llm.ainvoke([SystemMessage(content=system_prompt)] + messages)
    
    try:
        import json
        clean_text = response.content.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
        return {
            "target_country": data.get("country_code"),
            "procedure_topic": data.get("procedure_topic"),
            "procedure_category": data.get("procedure_category"),
        }
    except Exception:
        return {
            "target_country": state.get("target_country") or "GLOBAL",
            "procedure_topic": state.get("procedure_topic") or "General Inquiry",
            "procedure_category": state.get("procedure_category") or "OTHER",
        }


# ==============================================================================
# Node 2: Knowledge Base Grounding (RAG)
# ==============================================================================

async def retrieve_rules_node(state: AgentState) -> dict:
    """Queries vector store for exact criteria and document requirements."""
    topic = state.get("procedure_topic", "")
    country = state.get("target_country", "")
    category = state.get("procedure_category", "")

    query = f"Requirements and mandatory documents for {topic} in {country}"
    rag_text = await query_regulatory_knowledge_base.ainvoke({
        "query": query,
        "country_code": country,
        "category": category,
    })

    # Prompt LLM to extract the canonical list of required documents from retrieved text
    extraction_prompt = (
        f"Based on these official guidelines:\n{rag_text}\n\n"
        "Extract ONLY the list of mandatory document types needed (e.g., ['PASSPORT', 'TAX_RETURN', 'NATIONAL_ID']). "
        "Return a JSON array of uppercase strings."
    )
    res = await llm.ainvoke([HumanMessage(content=extraction_prompt)])

    required_docs = []
    try:
        import json
        clean_res = res.content.replace("```json", "").replace("```", "").strip()
        required_docs = json.loads(clean_res)
    except Exception:
        required_docs = ["PASSPORT", "NATIONAL_ID"]

    return {
        "retrieved_rules": [{"summary": rag_text}],
        "required_docs": required_docs,
    }


# ==============================================================================
# Node 3: Vault Audit
# ==============================================================================

async def audit_vault_node(state: AgentState) -> dict:
    """Compares required documents against what the user actually owns in the relational DB."""
    user_id = state["user_id"]
    required = state.get("required_docs", [])

    raw_checklist = await inspect_user_document_vault.ainvoke({
        "user_id": user_id,
        "required_types": required,
    })

    checklist_items: List[DocumentCheckItem] = []
    missing_docs: List[str] = []

    for item in raw_checklist:
        checklist_items.append(DocumentCheckItem(**item))
        if item["status"] in ["MISSING", "EXPIRED"]:
            missing_docs.append(item["doc_type"])

    is_complete = len(missing_docs) == 0
    return {
        "document_checklist": checklist_items,
        "missing_docs": missing_docs,
        "is_complete": is_complete,
        "requires_user_action": not is_complete,
    }


# ==============================================================================
# Node 4: Synthesis & Execution Guidance
# ==============================================================================

async def synthesize_guidance_node(state: AgentState) -> dict:
    """
    Generates step-by-step navigational guidance.
    Enforces absolute non-disclosure on Aadhaar, RRN, and MyNumber numbers.
    """
    checklist = state.get("document_checklist", [])
    missing = state.get("missing_docs", [])
    rules = state.get("retrieved_rules", [{}])[0].get("summary", "")
    topic = state.get("procedure_topic", "your procedure")

    checklist_summary = "\n".join([
        f"- {item.doc_type}: {item.status} ({item.notes or ''})"
        for item in checklist
    ])

    system_instruction = (
        "You are an expert bureaucratic navigator assisting the user with forms and procedures.\n"
        "Guidelines:\n"
        "1. Give direct, actionable instructions based on verified guidelines.\n"
        "2. Break steps down sequentially.\n"
        "3. Explicitly report which documents are verified and which are missing or need renewal.\n"
        "4. PRIVACY GUARDRAIL: Under NO circumstances should you output real identification digits "
        "for Aadhaar, Korean RRN, or Japanese MyNumber. Use placeholders like [Aadhaar Redacted] "
        "or [RRN Omitted] if filling forms or referencing them."
    )

    user_query = state["messages"][-1].content
    prompt = (
        f"User Query: {user_query}\n"
        f"Task: {topic}\n"
        f"Official Regulations:\n{rules}\n\n"
        f"Current Vault Document Checklist:\n{checklist_summary}\n\n"
        f"Missing/Expired Documents: {', '.join(missing) if missing else 'None! All prerequisites met.'}\n\n"
        "Provide a comprehensive, encouraging, and highly structured action plan."
    )

    response = await llm.ainvoke([
        SystemMessage(content=system_instruction),
        HumanMessage(content=prompt),
    ])

    return {
        "messages": [AIMessage(content=response.content)],
        "next_step_instruction": response.content,
    }


# ==============================================================================
# Workflow Graph Construction
# ==============================================================================

workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("parse_intent", parse_intent_node)
workflow.add_node("retrieve_rules", retrieve_rules_node)
workflow.add_node("audit_vault", audit_vault_node)
workflow.add_node("synthesize_guidance", synthesize_guidance_node)

# Flow Edges
workflow.set_entry_point("parse_intent")
workflow.add_edge("parse_intent", "retrieve_rules")
workflow.add_edge("retrieve_rules", "audit_vault")
workflow.add_edge("audit_vault", "synthesize_guidance")
workflow.add_edge("synthesize_guidance", END)

# Compile Graph
bureaucracy_agent_app = workflow.compile()