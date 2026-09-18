from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Application Info
    PROJECT_NAME: str = "Bureaucracy AI Agent"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Security & Tokens
    SECRET_KEY: str = Field(
        default="09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7",
        description="JWT signature secret key",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # AES-256 Storage Encryption Key (Must be 32 URL-safe base64-encoded bytes or 32 raw bytes)
    # Generate in production via: secrets.token_hex(32)
    DOCUMENT_ENCRYPTION_KEY: str = Field(
        default="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        description="Hex-encoded 32-byte key for AES-256-GCM",
    )

    # Relational Database (PostgreSQL via AsyncPG)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/bureaucracy_db",
        description="Async SQLAlchemy database connection URI",
    )

    # Vector Database & Embeddings
    CHROMA_PERSIST_DIR: str = str(Path(__file__).resolve().parents[2] / "data" / "chroma_store")
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"

    # External LLM / Multimodal APIs
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Document Storage Vault Path
    STORAGE_VAULT_PATH: str = str(Path(__file__).resolve().parents[2] / "data" / "encrypted_vault")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()