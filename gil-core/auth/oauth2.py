"""
GIL Core — auth/oauth2.py
SIH26129 Component: API Gateway Auth — OAuth2 simulation + JWT middleware

Provides:
  - FastAPI dependency get_current_user() for citizen endpoint protection
  - Token issuance handlers (called from gateway/router.py)

Simulated OAuth2: resource owner password grant (no real OAuth server needed).
Citizens authenticate with username=canonical_id, password (any value accepted
in demo mode). Role is supplied at login time for flexibility in demo scenarios.
"""

from typing import Optional
from fastapi import HTTPException, Header, status
import jwt as pyjwt

from auth.jwt_utils import verify_citizen_token, create_citizen_token, create_service_token
from config import get_settings

settings = get_settings()


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency for citizen-authenticated endpoints.
    SIH: API Gateway auth layer — validates JWT, returns claims dict.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1]
    try:
        claims = verify_citizen_token(token)
        return claims
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Access token has expired")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def issue_citizen_token(username: str, role: str) -> dict:
    """
    Issue OAuth2-style citizen access token.
    username = canonical_identifier (e.g. MAHA-2024-001).
    """
    token = create_citizen_token(
        subject=username,
        role=role,
        scopes=[f"read:{cat}" for cat in ["employment", "skills", "revenue"]],
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
        "role": role,
    }


def issue_service_token() -> dict:
    """Issue GIL service-to-service JWT for mock system calls."""
    token = create_service_token()
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 3600,
        "role": "GILService",
    }
