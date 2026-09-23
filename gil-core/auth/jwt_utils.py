"""
GIL Core — auth/jwt_utils.py
SIH26129 Component: Federated Identity (JWT-based service-to-service auth)

Federated Identity is implemented here via JWT:
  - Citizen tokens: short-lived, issued by /auth/token (OAuth2 simulation)
  - Service tokens: issued by /auth/service-token, used by GIL → mock systems
    Role claim "GILService" is required by all mock system endpoints.

JWT claims structure:
{
  "sub": "MAHA-2024-001",   # canonical citizen ID or service name
  "role": "Citizen",         # Citizen | SkillDeptOfficer | GILService | etc.
  "iss": "gil-auth",
  "exp": <unix timestamp>
}
"""

import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt as pyjwt

from config import get_settings

settings = get_settings()


def create_citizen_token(
    subject: str,
    role: str,
    scopes: Optional[list[str]] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    """Issue a citizen-facing access token (OAuth2 simulation)."""
    exp_minutes = expires_minutes or settings.access_token_expire_minutes
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "scopes": scopes or [],
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + timedelta(minutes=exp_minutes),
    }
    return pyjwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_service_token(service_name: str = "gil-core") -> str:
    """
    Issue a GIL service-to-service token.
    SIH: Federated Identity — GIL authenticates to mock systems via this token.
    Mock systems accept only tokens with role='GILService'.
    """
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": service_name,
        "role": "GILService",
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + timedelta(minutes=60),  # service tokens longer-lived
    }
    return pyjwt.encode(payload, settings.service_jwt_secret, algorithm=settings.jwt_algorithm)


def verify_citizen_token(token: str) -> dict:
    """Verify and decode a citizen access token. Raises jwt exceptions on failure."""
    return pyjwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        options={"verify_exp": True},
    )


def extract_role_from_token(token: str) -> str:
    """Extract role claim without full verification (for logging). Use verify_ for security."""
    try:
        payload = pyjwt.decode(token, options={"verify_signature": False})
        return payload.get("role", "Unknown")
    except Exception:
        return "Unknown"
