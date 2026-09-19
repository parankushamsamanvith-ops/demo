import json
from typing import Literal, List, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END

from app.core.config import settings
from app.agent.state import AgentState, DocumentCheckItem
from app.agent.tools import (
    query_regulatory_knowledge_base,
    inspect_user_document_vault,
)

if settings.GROQ_API_KEY:
    llm = ChatOpenAI(
        model=settings.GROQ_MODEL_NAME,
        api_key=settings.GROQ_API_KEY,
        base_url=settings.GROQ_BASE_URL,
        temperature=0.1,
    )
elif settings.XAI_API_KEY:
    llm = ChatOpenAI(
        model="grok-2-latest",
        api_key=settings.XAI_API_KEY,
        base_url=settings.XAI_BASE_URL,
        temperature=0.1,
    )
else:
    llm = ChatGoogleGenerativeAI(
        model="gemini-3.6-flash",
        google_api_key=settings.GEMINI_API_KEY or "DUMMY_KEY",
        temperature=0.1,
    )


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                texts.append(item["text"])
            elif isinstance(item, str):
                texts.append(item)
            elif hasattr(item, "text"):
                texts.append(getattr(item, "text"))
            else:
                texts.append(str(item))
        return "".join(texts)
    return str(content)


async def parse_intent_node(state: AgentState) -> dict:
    messages = state["messages"]
    system_prompt = (
        "Extract the bureaucratic task, target ISO 3-letter country code, and category "
        "(VISA, TAXATION, IDENTITY, EDUCATION, CIVIL, OTHER). "
        'Respond ONLY in valid JSON: {"country_code": "...", "procedure_topic": "...", "procedure_category": "..."}'
    )

    response = await llm.ainvoke([SystemMessage(content=system_prompt)] + messages)

    try:
        raw_text = _extract_text(response.content)
        clean_text = raw_text.replace("```json", "").replace("```", "").strip()
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

    if not rag_text or "No specific regulatory guidelines found" in rag_text:
        return {
            "retrieved_rules": [{"summary": rag_text or "No specific regulatory guidelines found in knowledge base."}],
            "required_docs": [],
        }

    extraction_prompt = (
        f"From these guidelines:\n{rag_text}\n\n"
        "Output ONLY a JSON array of mandatory uppercase document types (e.g., ['PASSPORT', 'TAX_RETURN']). "
        "If no specific guidelines or mandatory documents are specified, output an empty array []."
    )
    res = await llm.ainvoke([HumanMessage(content=extraction_prompt)])

    try:
        raw_res = _extract_text(res.content)
        clean_res = raw_res.replace("```json", "").replace("```", "").strip()
        required_docs = json.loads(clean_res)
        if not isinstance(required_docs, list):
            required_docs = []
    except Exception:
        required_docs = []

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

    has_required = len(required) > 0
    is_complete = has_required and (len(missing_docs) == 0)
    requires_user_action = (not has_required) or (len(missing_docs) > 0)

    return {
        "document_checklist": checklist_items,
        "missing_docs": missing_docs,
        "is_complete": is_complete,
        "requires_user_action": requires_user_action,
    }


async def synthesize_guidance_node(state: AgentState) -> dict:
    checklist = state.get("document_checklist", [])
    missing = state.get("missing_docs", [])
    required = state.get("required_docs", [])
    rules = state.get("retrieved_rules", [{}])[0].get("summary", "")
    topic = state.get("procedure_topic", "your procedure")

    checklist_summary = "\n".join([
        f"- {item.doc_type} ({item.title or 'Uploaded'}): {item.status} - {item.notes or ''}"
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
        "or [RRN Omitted] if filling forms or referencing them.\n"
        "5. ACCURACY GUARDRAIL: If no specific procedure was identified or if no official requirements were retrieved, "
        "DO NOT assume or state that the user is ready to submit. Acknowledge the documents in their vault and ask "
        "which specific administrative procedure or application they want to complete."
    )

    user_query = state["messages"][-1].content

    if not required:
        status_assessment = (
            "NOTICE: No specific procedural guidelines or checklist requirements were identified for this query.\n"
            "Do NOT claim that all prerequisites or requirements are met, and do NOT claim the user is ready to submit.\n"
            "Instead, inform the user about the documents currently in their vault (if any), and politely ask them to specify "
            "which exact administrative procedure, visa, license, or application they are preparing for so you can check the requirements."
        )
    elif missing:
        status_assessment = f"Missing or expired required documents: {', '.join(missing)}. The user must provide or update these."
    else:
        status_assessment = "All required documents for this verified procedure are present and valid in the vault. The user is ready for submission."

    prompt = (
        f"User Query: {user_query}\n"
        f"Detected Task/Procedure: {topic}\n"
        f"Official Regulations Retrieved:\n{rules}\n\n"
        f"User's Document Vault Status:\n{checklist_summary if checklist_summary else 'No documents found in vault.'}\n\n"
        f"Status Assessment:\n{status_assessment}\n\n"
        "Provide a helpful, precise, and structured response addressing the user's situation."
    )

    response = await llm.ainvoke([
        SystemMessage(content=system_instruction),
        HumanMessage(content=prompt),
    ])

    response_text = _extract_text(response.content)

    return {
        "messages": [AIMessage(content=response_text)],
        "next_step_instruction": response_text,
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