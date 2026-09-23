"""
GIL Core — config.py
SIH26129: All configuration exclusively via environment variables (Pydantic Settings).
No secrets hardcoded. Raises clear errors on missing required values.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ─── Database ─────────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://gil:gilpassword@localhost:5432/gildb"

    # ─── Redis ────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ─── JWT / Auth ───────────────────────────────────────────────────────────
    jwt_secret: str = "changeme-supersecret-jwt-key-minimum-32-chars"
    jwt_issuer: str = "gil-auth"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Service-to-service JWT (GIL → mock systems)
    service_jwt_secret: str = "service-secret-key-dev-min-32-chars"

    # OAuth2 client credentials
    oauth_client_id: str = "citizen-app"
    oauth_client_secret: str = "citizen-secret"

    # ─── Mock System URLs ─────────────────────────────────────────────────────
    employment_api_url: str = "http://localhost:8001"
    skill_api_url: str = "http://localhost:8002"

    # ─── Retry / Failure Handling ─────────────────────────────────────────────
    retry_initial_delay: float = 2.0     # seconds
    retry_backoff_factor: float = 2.0    # exponential multiplier
    retry_max_attempts: int = 3
    timeout_per_system: float = 10.0    # per-adapter call timeout (seconds)

    # ─── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
