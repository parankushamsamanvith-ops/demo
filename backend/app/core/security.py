import os
import base64
from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ==============================================================================
# 1. Password Management & JWT Auth
# ==============================================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify raw password against stored bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate bcrypt password hash."""
    return pwd_context.hash(password)


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


# ==============================================================================
# 2. Bank-Grade Field & File Encryption (AES-256-GCM)
# ==============================================================================

def _get_aes_key() -> bytes:
    """Retrieve validated 32-byte key for AES-256."""
    key = bytes.fromhex(settings.DOCUMENT_ENCRYPTION_KEY)
    if len(key) != 32:
        raise ValueError("DOCUMENT_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters).")
    return key


def encrypt_field(plain_text: str) -> str:
    """
    Encrypts a sensitive text string using AES-256-GCM.
    Returns: Standard base64-encoded string containing [12-byte Nonce + Ciphertext + 16-byte Tag].
    """
    if not plain_text:
        return ""
    
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit standard nonce for GCM
    
    ciphertext = aesgcm.encrypt(nonce, plain_text.encode("utf-8"), associated_data=None)
    payload = nonce + ciphertext
    return base64.b64encode(payload).decode("utf-8")


def decrypt_field(encrypted_payload: str) -> str:
    """
    Decrypts a base64-encoded AES-256-GCM payload.
    Recovers original plain text.
    """
    if not encrypted_payload:
        return ""
    
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    raw_data = base64.b64decode(encrypted_payload.encode("utf-8"))
    
    nonce = raw_data[:12]
    ciphertext = raw_data[12:]
    
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
    return decrypted_bytes.decode("utf-8")


def encrypt_file_bytes(data: bytes) -> bytes:
    """Encrypt binary payload (PDF/Image) with AES-256-GCM before writing to disk."""
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, data, associated_data=None)
    return nonce + ciphertext


def decrypt_file_bytes(encrypted_data: bytes) -> bytes:
    """Decrypt binary payload read from the encrypted disk vault."""
    key = _get_aes_key()
    aesgcm = AESGCM(key)
    nonce = encrypted_data[:12]
    ciphertext = encrypted_data[12:]
    return aesgcm.decrypt(nonce, ciphertext, associated_data=None)