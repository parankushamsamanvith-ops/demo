from fastapi import APIRouter
from app.api.v1.documents import router as documents_router
from app.api.v1.agent import router as agent_router

api_router = APIRouter()
api_router.include_router(documents_router)
api_router.include_router(agent_router)