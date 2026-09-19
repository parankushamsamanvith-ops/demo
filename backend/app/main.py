from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import settings
from app.api.router import api_router
from app.services.scheduler import scheduler_service
from app.db.session import engine, async_session_factory
from app.db.models import Base, User


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite tables automatically
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default user for local testing
    async with async_session_factory() as session:
        user_id = "11111111-1111-1111-1111-111111111111"
        res = await session.execute(select(User).where(User.id == user_id))
        if not res.scalar_one_or_none():
            demo_user = User(
                id=user_id,
                email="user@example.com",
                hashed_password="mock_password",
                full_name="Verified Citizen",
            )
            session.add(demo_user)
            await session.commit()

    # Start background expiration auditor
    scheduler_service.start()
    yield
    scheduler_service.shutdown()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": settings.VERSION}


# Serve built React frontend for web & tunnel access
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            return {"error": "Not Found"}
        target_file = frontend_dist / full_path
        if target_file.is_file():
            return FileResponse(target_file)
        return FileResponse(frontend_dist / "index.html")