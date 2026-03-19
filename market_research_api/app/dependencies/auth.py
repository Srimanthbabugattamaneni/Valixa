"""
Service-to-service authentication dependency.

The Next.js backend must include the header:
    X-API-Key: <value of AI_SERVICE_API_KEY in .env.local>

This value must match API_SECRET_KEY in the FastAPI .env.
"""
import secrets

from fastapi import Header, HTTPException, status

from app.config import settings


async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")) -> None:
    """
    FastAPI dependency — validates the shared API key on every protected route.
    Uses secrets.compare_digest to prevent timing attacks.
    """
    if not secrets.compare_digest(x_api_key, settings.API_SECRET_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
