"""
Mock Employment System — main.py
SIH26129 GIL Component: Modern REST API (brownfield target system)

Endpoints:
  GET  /health                  — liveness/readiness check
  GET  /employee/{id}           — fetch employee record by native EMP-ID
  POST /employee/search         — search employees by criteria
  POST /admin/toggle-failure    — deterministic failure simulation (in-memory flag)

Security: validates SERVICE_JWT in Authorization header for all non-health endpoints.
"""

import os
import time
import logging
import hashlib
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import jwt

from data import EMPLOYEES

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","svc":"mock-employment","msg":"%(message)s"}'
)
log = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────
SERVICE_JWT_SECRET = os.environ.get("SERVICE_JWT_SECRET", "service-secret-key-dev")
PORT = int(os.environ.get("PORT", "8001"))

# ─── In-memory failure flag (toggled via /admin/toggle-failure) ───────────────
FAILURE_MODE: bool = False

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Mock Employment System",
    description="SIH26129 GIL — Brownfield target: modern REST departmental system",
    version="1.0.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ─── Auth dependency ──────────────────────────────────────────────────────────
def verify_service_jwt(authorization: Optional[str] = Header(None)) -> dict:
    """Validate GIL service-to-service JWT. SIH: Federated Identity / API Gateway auth."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SERVICE_JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "GILService":
            raise HTTPException(status_code=403, detail="Insufficient role: GILService required")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Service token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid service token: {e}")

# ─── Request/Response Models ──────────────────────────────────────────────────
class SearchRequest(BaseModel):
    district: Optional[str] = None
    employment_status: Optional[str] = None
    department_code: Optional[str] = None

class FailureToggleResponse(BaseModel):
    failure_mode: bool
    message: str

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """SIH: Health endpoint — each mock system independently health-checkable."""
    return {
        "status": "healthy" if not FAILURE_MODE else "degraded",
        "service": "mock-employment",
        "failure_mode": FAILURE_MODE,
        "employee_count": len(EMPLOYEES),
    }

@app.get("/employee/{emp_id}")
async def get_employee(emp_id: str, _: dict = Depends(verify_service_jwt)):
    """
    SIH: Connector/Adapter target endpoint.
    Returns employee record by native EMP-ID (not canonical citizen ID).
    GIL's RestAdapter calls this after identity mapping resolves EMP-ID from canonical_id.
    """
    # SIH: Simulate deterministic failure for failure-handling demo
    if FAILURE_MODE:
        log.warning(f"FAILURE_MODE active — returning 503 for {emp_id}")
        raise HTTPException(status_code=503, detail="Employment system temporarily unavailable (simulated failure)")

    employee = EMPLOYEES.get(emp_id)
    if not employee:
        raise HTTPException(status_code=404, detail=f"Employee {emp_id} not found")

    log.info(f"Fetched employee {emp_id}")
    return employee

@app.post("/employee/search")
async def search_employees(req: SearchRequest, _: dict = Depends(verify_service_jwt)):
    """Bulk search by criteria — supports partial field matching."""
    if FAILURE_MODE:
        raise HTTPException(status_code=503, detail="Employment system temporarily unavailable (simulated failure)")

    results = list(EMPLOYEES.values())
    if req.district:
        results = [e for e in results if e.get("district", "").lower() == req.district.lower()]
    if req.employment_status:
        results = [e for e in results if e.get("employment_status") == req.employment_status]
    if req.department_code:
        results = [e for e in results if e.get("department_code") == req.department_code]

    return {"count": len(results), "employees": results}

@app.post("/admin/toggle-failure", response_model=FailureToggleResponse)
async def toggle_failure():
    """
    SIH: Simulate-failure toggle — flips in-memory FAILURE_MODE flag.
    No auth required (admin/test endpoint). Dashboard uses this for failure-handling demo.
    """
    global FAILURE_MODE
    FAILURE_MODE = not FAILURE_MODE
    status = "ENABLED" if FAILURE_MODE else "DISABLED"
    log.warning(f"Failure mode {status}")
    return FailureToggleResponse(
        failure_mode=FAILURE_MODE,
        message=f"Employment system failure simulation {status}"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
