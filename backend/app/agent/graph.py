import json
from typing import Literal, List, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END

from app.core.config import settings
from app.agent.state import AgentState, DocumentCheckItem
from app.agent.tools import (
    query_regulatory_knowledge_base,
    inspect_user_document_vault,
)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=settings.GEMINI_API_KEY,
    temperature=0.1,
)


async def parse_intent_node(state: AgentState) -> dict:
    messages = state["messages"]
    system_prompt = (
        "Extract the bureaucratic task, target ISO 3-letter country code, and category "
        "(VISA, TAXATION, IDENTITY, EDUCATION, CIVIL, OTHER). "
        'Respond ONLY in valid JSON: {"country_code": "...", "procedure_topic": "...", "procedure_category": "..."}'
    )

    response = await llm.ainvoke([SystemMessage(content=system_prompt)] + messages)

    try:
        clean_text = response.content.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
        return {
            "target_country": data.get("country_code", "GLOBAL"),
            "procedure_topic": data.get("procedure_topic", "General Bureaucratic Inquiry"),
            "procedure_category": data.get("procedure_category", "OTHER"),
        }
    except Exception:
        return {
            "target_country": state.get("target_country") or "GLOBAL",
            "procedure_topic": state.get("procedure_topic") or "General Inquiry",
            "procedure_category": state.get("procedure_category") or "OTHER",
        }


async def retrieve_rules_node(state: AgentState) -> dict:
    topic = state.get("procedure_topic", "")
    country = state.get("target_country", "GLOBAL")
    category = state.get("procedure_category", "OTHER")

    query = f"Required documents and application rules for {topic} in {country}"
    rag_text = await query_regulatory_knowledge_base.ainvoke({
        "query": query,
        "country_code": country,
        "category": category,
    })

    extraction_prompt = (
        f"From these guidelines:\n{rag_text}\n\n"
        "Output ONLY a JSON array of mandatory uppercase document types (e.g., ['PASSPORT', 'TAX_RETURN'])."
    )
    res = await llm.ainvoke([HumanMessage(content=extraction_prompt)])

    try:
        clean_res = res.content.replace("```json", "").replace("```", "").strip()
        required_docs = json.loads(clean_res)
    except Exception:
        required_docs = ["PASSPORT", "NATIONAL_ID"]

    return {
        "retrieved_rules": [{"summary": rag_text}],
        "required_docs": required_docs,
    }


async def audit_vault_node(state: AgentState) -> dict:
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

    return {
        "document_checklist": checklist_items,
        "missing_docs": missing_docs,
        "is_complete": len(missing_docs) == 0,
        "requires_user_action": len(missing_docs) > 0,
    }


async def synthesize_guidance_node(state: AgentState) -> dict:
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


workflow = StateGraph(AgentState)
workflow.add_node("parse_intent", parse_intent_node)
workflow.add_node("retrieve_rules", retrieve_rules_node)
workflow.add_node("audit_vault", audit_vault_node)
workflow.add_node("synthesize_guidance", synthesize_guidance_node)

workflow.set_entry_point("parse_intent")
workflow.add_edge("parse_intent", "retrieve_rules")
workflow.add_edge("retrieve_rules", "audit_vault")
workflow.add_edge("audit_vault", "synthesize_guidance")
workflow.add_edge("synthesize_guidance", END)

bureaucracy_agent_app = workflow.compile()