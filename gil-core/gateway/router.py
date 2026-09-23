"""
GIL Core — gateway/router.py
SIH26129 Component: API Gateway (all GIL HTTP routes)

Routes:
  POST /auth/token                   — citizen OAuth2 token (simulated)
  POST /auth/service-token           — GIL service JWT

  POST /api/v1/requests              — start orchestration
  GET  /api/v1/requests/{id}/status  — poll status
  GET  /api/v1/requests/{id}/stream  — SSE real-time status stream

  GET  /api/v1/audit/{request_id}    — audit log viewer
  GET  /api/v1/audit/actor/{actor}   — audit by actor

  GET  /api/v1/manual-review         — list pending manual review items
  POST /api/v1/manual-review/{id}/resolve — resolve manual review item
  POST /api/v1/manual-review/{id}/retry   — force retry (re-queues in Redis)

  GET  /api/v1/consent/{citizen_id}  — get consent status
  POST /api/v1/consent               — grant/revoke consent

  GET  /health                       — GIL health
  GET  /metrics                      — Prometheus metrics
"""

import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from audit.logger import get_audit_log, get_audit_by_actor
from auth.oauth2 import get_current_user, issue_citizen_token, issue_service_token
from consent.manager import grant_consent, revoke_consent, get_all_consented_categories
from db.session import get_db
from models.schemas import (
    OrchestrationRequest, OrchestrationResponse, OrchestrationStatusResponse,
    AuditLogResponse, ManualReviewItem, ResolveRequest,
    TokenRequest, TokenResponse, ConsentUpdateRequest,
)
from monitoring.metrics import metrics_response, gil_manual_review_queue_depth
from orchestrator.schemes import load_scheme_definitions
from orchestrator.workflow import run_orchestration, sse_stream, get_orch_details

log = logging.getLogger(__name__)
router = APIRouter()


# ─── Auth ──────────────────────────────────────────────────────────────────────

@router.post("/auth/token", response_model=TokenResponse, tags=["Auth"])
async def get_token(req: TokenRequest):
    """
    SIH: OAuth2 simulation — issue citizen access token.
    username = canonical_identifier (e.g. MAHA-2024-001)
    password = any value (demo mode; replace with real auth in production)
    """
    return issue_citizen_token(username=req.username, role=req.role)


@router.post("/auth/service-token", tags=["Auth"])
async def get_service_token():
    """SIH: Issue GIL service-to-service JWT (GILService role)."""
    return issue_service_token()


# ─── Orchestration ─────────────────────────────────────────────────────────────

@router.post("/api/v1/requests", response_model=OrchestrationResponse, status_code=202, tags=["GIL"])
async def create_request(
    req: OrchestrationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    SIH Pipeline: POST /api/v1/requests — start cross-system orchestration.
    RBAC note: requested_by role governs RESPONSE field visibility only.
    The orchestrator fetches all data_categories covered by citizen consent.
    """
    request_id = str(uuid.uuid4())

    # Create orchestration record
    await db.execute(
        text("""
            INSERT INTO orchestration_requests
              (request_id, canonical_identifier, data_categories, purpose, requested_by, overall_status)
            VALUES (:rid, :cid, :cats, :purpose, :by, 'received')
        """),
        {
            "rid": request_id,
            "cid": req.citizen_id,
            "cats": req.data_categories,
            "purpose": req.purpose,
            "by": req.requested_by,
        },
    )
    await db.commit()

    # Run orchestration in background with independent session
    background_tasks.add_task(run_orchestration, req, request_id, None)

    log.info(f"Orchestration started request_id={request_id} citizen={req.citizen_id}")
    return OrchestrationResponse(
        request_id=request_id,
        status="received",
        sse_url=f"/api/v1/requests/{request_id}/stream",
    )




@router.get("/api/v1/workflows/schemes", tags=["Workflows"])
async def get_schemes():
    """List all pre-configured Maharashtra Government scheme workflow pipelines."""
    return load_scheme_definitions()


@router.get("/api/v1/requests/{request_id}/status", response_model=OrchestrationStatusResponse, tags=["GIL"])
async def get_request_status(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Poll orchestration status and consolidated result."""
    result = await db.execute(
        text("""
            SELECT request_id, overall_status, requested_by, system_statuses,
                   result, rbac_redactions, created_at, completed_at, canonical_identifier
            FROM orchestration_requests WHERE request_id = :rid
        """),
        {"rid": request_id},
    )
    row = result.mappings().fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Request {request_id} not found")

    sys_statuses = row["system_statuses"] or {}
    if isinstance(sys_statuses, str):
        sys_statuses = json.loads(sys_statuses)

    result_data = row["result"]
    if isinstance(result_data, str):
        result_data = json.loads(result_data)

    meta = sys_statuses.get("__meta__", {}) if isinstance(sys_statuses, dict) else {}
    details = get_orch_details(request_id) or meta

    pure_systems = {k: v for k, v in sys_statuses.items() if not k.startswith("__")}

    return OrchestrationStatusResponse(
        request_id=str(row["request_id"]),
        overall_status=row["overall_status"],
        requested_by_role=row["requested_by"] or "Unknown",
        systems=pure_systems,
        result=result_data,
        rbac_redactions=row["rbac_redactions"] or [],
        created_at=row["created_at"],
        completed_at=row["completed_at"],
        scheme_id=details.get("scheme_id"),
        scheme_name=details.get("scheme_name"),
        data_quality=details.get("data_quality"),
        sla_metrics=details.get("sla_metrics"),
        notifications=details.get("notifications"),
    )


@router.get("/api/v1/requests/{request_id}/stream", tags=["GIL"])
async def stream_status(request_id: str, _: dict = Depends(get_current_user)):
    """
    SIH: Event Manager — SSE real-time status stream.
    Streams pipeline stage events as Server-Sent Events to the frontend dashboard.
    """
    return StreamingResponse(
        sse_stream(request_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─── Audit ─────────────────────────────────────────────────────────────────────

@router.get("/api/v1/audit/{request_id}", response_model=AuditLogResponse, tags=["Audit"])
async def get_audit(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """SIH: Read-only audit log viewer filtered by request_id."""
    entries = await get_audit_log(db, request_id)
    return AuditLogResponse(request_id=request_id, entries=entries)


@router.get("/api/v1/audit/actor/{actor}", tags=["Audit"])
async def get_audit_by_actor_route(
    actor: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Read-only audit entries by actor (citizen or officer ID)."""
    entries = await get_audit_by_actor(db, actor)
    return {"actor": actor, "entries": entries}


# ─── Manual Review ─────────────────────────────────────────────────────────────

@router.get("/api/v1/manual-review", tags=["Manual Review"])
async def list_manual_review(
    status: Optional[str] = "pending",
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """List items in manual review queue (Postgres Tier 2)."""
    result = await db.execute(
        text("""
            SELECT id, request_id, system_name, error_trace, retry_count,
                   status, created_at, resolved_at, resolved_by
            FROM manual_review_queue
            WHERE status = :status
            ORDER BY created_at DESC
        """),
        {"status": status},
    )
    items = [
        {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in r.items()}
        for r in result.mappings().fetchall()
    ]
    # Update Prometheus gauge
    gil_manual_review_queue_depth.set(len([i for i in items if i["status"] == "pending"]))
    return {"status": status, "count": len(items), "items": items}


@router.post("/api/v1/manual-review/{review_id}/resolve", tags=["Manual Review"])
async def resolve_manual_review(
    review_id: str,
    req: ResolveRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Mark a manual review item as resolved."""
    result = await db.execute(
        text("""
            UPDATE manual_review_queue
            SET status='resolved', resolved_at=NOW(), resolved_by=:by, notes=:notes
            WHERE id=:id AND status='pending'
            RETURNING id, request_id, system_name
        """),
        {"id": review_id, "by": req.resolved_by, "notes": req.notes},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Manual review item not found or already resolved")
    await db.commit()
    gil_manual_review_queue_depth.dec()
    return {"status": "resolved", "resolved_at": "now", "id": review_id}


# ─── Consent ───────────────────────────────────────────────────────────────────

@router.get("/api/v1/consent/{citizen_id}", tags=["Consent"])
async def get_consent_status(
    citizen_id: str,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Get current consent state for a canonical citizen identifier."""
    # Resolve canonical_id from identifier
    result = await db.execute(
        text("SELECT canonical_id FROM canonical_citizens WHERE canonical_identifier=:ci"),
        {"ci": citizen_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Citizen {citizen_id} not found")
    canonical_id = str(row[0])
    categories = await get_all_consented_categories(db, canonical_id)
    return {"citizen_id": citizen_id, "canonical_id": canonical_id, "consented_categories": categories}


@router.post("/api/v1/consent", tags=["Consent"])
async def update_consent(
    req: ConsentUpdateRequest,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """Grant or revoke consent for a citizen."""
    result = await db.execute(
        text("SELECT canonical_id FROM canonical_citizens WHERE canonical_identifier=:ci"),
        {"ci": req.citizen_id},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Citizen {req.citizen_id} not found")
    canonical_id = str(row[0])

    if req.revoke:
        count = await revoke_consent(db, canonical_id)
        return {"action": "revoked", "count": count, "citizen_id": req.citizen_id}
    else:
        consent_id = await grant_consent(db, canonical_id, req.data_categories, req.granted_by)
        return {"action": "granted", "consent_id": consent_id, "categories": req.data_categories}


# ─── Mock System Admin (failure toggles) ───────────────────────────────────────

@router.post("/api/v1/admin/toggle-failure/{system}", tags=["Admin"])
async def toggle_failure(system: str, _: dict = Depends(get_current_user)):
    """
    SIH: Simulate-failure toggle — forwards to mock system's /admin/toggle-failure.
    Supports: employment, skill
    """
    import httpx
    from config import get_settings
    settings = get_settings()

    urls = {
        "employment": f"{settings.employment_api_url}/admin/toggle-failure",
        "skill": f"{settings.skill_api_url}/admin/toggle-failure",
    }
    url = urls.get(system)
    if not url:
        raise HTTPException(status_code=400, detail=f"Unknown system '{system}'. Use: employment, skill")

    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(url)
    return resp.json()


# ─── Health & Metrics ──────────────────────────────────────────────────────────

@router.get("/health", tags=["System"])
async def health(db: AsyncSession = Depends(get_db)):
    """GIL liveness + DB connectivity check."""
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "gil-core",
        "database": "connected" if db_ok else "disconnected",
    }


@router.get("/metrics", tags=["System"])
async def metrics():
    """SIH: Monitoring — Prometheus-format metrics endpoint."""
    return metrics_response()
