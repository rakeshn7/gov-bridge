"""
GIL Core — main.py
SIH26129: Government Interoperability Layer — FastAPI application entry point

Mounts all routers, configures CORS, structured JSON logging, and startup events.
"""

import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from gateway.router import router

# ─── Structured JSON logging ──────────────────────────────────────────────────
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","svc":"gil-core","logger":"%(name)s","msg":"%(message)s"}',
)

settings = get_settings()

# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="SIH26129 — Government Interoperability Layer (GIL)",
    description=(
        "Brownfield middleware for Maharashtra Govt departmental integration. "
        "Provides schema mapping, identity federation, consent management, "
        "RBAC enforcement, workflow orchestration, audit logging, and resilient "
        "failure handling across Employment, Skill, and Revenue systems."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ───────────────────────────────────────────────────────────────────
app.include_router(router)


# ─── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    logging.getLogger(__name__).info(
        "GIL Core started. DB=%s REDIS=%s",
        settings.database_url.split("@")[-1],  # log host only, not credentials
        settings.redis_url,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
