"""
GIL Core — models/schemas.py
SIH26129: Canonical data schemas and GIL internal message envelopes.

CanonicalEnvelope  — normalized output from any adapter.fetch()
OperationResult    — output from any adapter.submit()
StatusEnvelope     — pipeline stage status per system
OrchestrationRequest / OrchestrationStatus — API request/response shapes
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field
import uuid


# ─── Adapter Contract Types ───────────────────────────────────────────────────

class CanonicalEnvelope(BaseModel):
    """
    Normalised output from AdapterBase.fetch().
    Every adapter must return this shape after applying schema mapping.
    raw_data = native system response; canonical_data = mapped fields.
    """
    canonical_id: str                           # canonical citizen ID (MAHA-xxxx)
    system_name: str                            # 'employment' | 'skill' | 'revenue'
    system_identifier: str                      # native ID used in target system
    raw_data: dict[str, Any]                    # verbatim native response
    canonical_data: dict[str, Any]              # mapped to canonical schema
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    request_id: str


class OperationResult(BaseModel):
    """Output from AdapterBase.submit()."""
    request_id: str
    system_name: str
    status: Literal["success", "failure", "pending"]
    message: str
    data: Optional[dict[str, Any]] = None


class StatusEnvelope(BaseModel):
    """Per-system pipeline status from AdapterBase.status()."""
    request_id: str
    system_name: str
    stage: str          # received | dispatched | success | failure | retry | manual_review
    retry_count: int = 0
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    error: Optional[str] = None


# ─── GIL API Request / Response Shapes ───────────────────────────────────────

class OrchestrationRequest(BaseModel):
    """
    POST /api/v1/requests — citizen submits consolidated cross-system request.
    requested_by role governs RESPONSE field visibility (RBAC), NOT which
    categories are fetched (that is governed by consent).
    """
    citizen_id: str = Field(..., example="MAHA-2024-001")
    data_categories: list[str] = Field(default_factory=lambda: ["employment", "skills", "revenue"], example=["employment", "skills", "revenue"])
    purpose: str = Field(default="scheme_eligibility_check", example="scheme_eligibility_check")
    requested_by: str = Field(..., example="SkillDeptOfficer")
    scheme_id: Optional[str] = Field(None, example="cmegp")


class OrchestrationResponse(BaseModel):
    """202 response to POST /api/v1/requests."""
    request_id: str
    status: str = "received"
    sse_url: str


class SystemStatus(BaseModel):
    stage: str
    retry_count: int = 0
    error: Optional[str] = None


class OrchestrationStatusResponse(BaseModel):
    """GET /api/v1/requests/{id}/status"""
    request_id: str
    overall_status: str
    requested_by_role: str
    systems: dict[str, SystemStatus]
    result: Optional[dict[str, Any]] = None
    rbac_redactions: list[str] = []
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    scheme_id: Optional[str] = None
    scheme_name: Optional[str] = None
    data_quality: Optional[dict[str, Any]] = None
    sla_metrics: Optional[dict[str, Any]] = None
    notifications: Optional[list[dict[str, Any]]] = None


class AuditEntry(BaseModel):
    audit_id: str
    timestamp: datetime
    actor: str
    action: str
    target_system: Optional[str]
    data_category: Optional[str]
    payload_hash: Optional[str]
    consent_id: Optional[str]
    result_status: Optional[str]
    request_id: Optional[str]
    metadata: Optional[dict]


class AuditLogResponse(BaseModel):
    request_id: str
    entries: list[AuditEntry]


class ManualReviewItem(BaseModel):
    id: str
    request_id: str
    system_name: str
    error_trace: Optional[str]
    retry_count: int
    status: str
    created_at: datetime
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]


class ResolveRequest(BaseModel):
    resolved_by: str
    notes: Optional[str] = None


class TokenRequest(BaseModel):
    """POST /auth/token — simulate OAuth2 resource owner password grant."""
    username: str
    password: str
    role: str = "Citizen"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    role: str


class ConsentUpdateRequest(BaseModel):
    citizen_id: str
    data_categories: list[str]
    revoke: bool = False
    granted_by: str = "citizen-self"
