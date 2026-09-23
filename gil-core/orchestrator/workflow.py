"""
GIL Core — orchestrator/workflow.py
SIH26129 Component: Workflow Orchestrator + Event Manager (SSE)

Implements the full GIL pipeline:
  received → validated → mapped → identity_resolved → consent_checked →
  dispatched->{system} → response_received->{system} → aggregated →
  quality_evaluated → rbac_applied → notifications_dispatched →
  completed | failed | manual_review

Capabilities:
1. Configurable Workflow Schemes (workflows.yaml & schemes.py)
2. Data Quality & Cross-Registry Reconciliation (quality/validator.py)
3. Event-Driven Citizen Notifications Dispatch (notifications/dispatcher.py)
4. SLA Compliance Benchmarking (Maharashtra Right to Public Services Act benchmark)
5. Server-Sent Events (SSE) Real-Time Stream
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import ServerSentEvent

from db.session import AsyncSessionLocal
from adapters.base import AdapterError
from adapters.rest_adapter import RestAdapter
from adapters.soap_adapter import SoapAdapter
from adapters.db_adapter import DbAdapter
from audit.logger import write_audit
from consent.manager import check_consent, ConsentDeniedError
from identity.mdm import lookup_canonical, resolve_system_id, SystemIdentifierNotFoundError
from models.schemas import OrchestrationRequest
from monitoring.metrics import (
    gil_requests_total, gil_request_latency_seconds,
    gil_manual_review_queue_depth, gil_rbac_redactions_total,
    gil_consent_denied_total,
)
from notifications.dispatcher import NotificationDispatcher
from orchestrator.retry import with_retry, RetryExhaustedError, push_to_manual_review
from orchestrator.schemes import get_scheme
from quality.validator import DataQualityValidator
from rbac.enforcer import enforce_rbac

log = logging.getLogger(__name__)

# In-memory stores
_event_store: dict[str, list[dict]] = {}
_orch_details: dict[str, dict] = {}

SYSTEM_CATEGORY_MAP = {
    "employment": "employment",
    "skill": "skills",
    "revenue": "revenue",
}


def get_orch_details(request_id: str) -> dict | None:
    """Retrieve metadata details (quality, SLA, notifications) for a request."""
    return _orch_details.get(request_id)


def _emit(request_id: str, stage: str, system: str | None = None, data: dict | None = None):
    """Push a status event to the in-memory SSE store."""
    event = {
        "stage": stage,
        "system": system,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "data": data or {},
    }
    _event_store.setdefault(request_id, []).append(event)
    log.info(f"[Orchestrator] SSE event request_id={request_id} stage={stage} system={system}")


async def sse_stream(request_id: str) -> AsyncGenerator[ServerSentEvent, None]:
    """
    Event Manager — SSE generator for real-time status updates.
    Polls in-memory event store and yields new events to connected clients.
    """
    last_sent = 0
    timeout = 120  # 2 minutes max stream duration
    start = time.time()

    while time.time() - start < timeout:
        events = _event_store.get(request_id, [])
        while last_sent < len(events):
            evt = events[last_sent]
            yield ServerSentEvent(data=json.dumps(evt), event="status")
            last_sent += 1

        # Check if orchestration is complete
        if events and events[-1]["stage"] in ("completed", "failed"):
            break
        await asyncio.sleep(0.3)


async def run_orchestration(
    request: OrchestrationRequest,
    request_id: str,
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    if db is None:
        async with AsyncSessionLocal() as session:
            return await _run_orchestration_impl(request, request_id, session)
    else:
        return await _run_orchestration_impl(request, request_id, db)


async def _run_orchestration_impl(
    request: OrchestrationRequest,
    request_id: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """
    Full GIL Pipeline Execution with Configurable Schemes, Data Quality,
    Notifications, and SLA tracking.
    """
    start_time = time.time()
    actor = request.requested_by
    canonical_identifier = request.citizen_id

    # ── 0. Scheme Resolution ───────────────────────────────────────────────
    scheme = get_scheme(request.scheme_id) if request.scheme_id else None
    scheme_name = scheme.get("name") if scheme else "Custom Multi-Department Query"
    target_sla = scheme.get("sla_target_seconds", 2.0) if scheme else 2.0

    if scheme and scheme.get("categories"):
        requested_categories = scheme["categories"]
    else:
        requested_categories = request.data_categories or list(SYSTEM_CATEGORY_MAP.values())

    _emit(request_id, "received", data={
        "scheme_id": request.scheme_id,
        "scheme_name": scheme_name,
        "categories": requested_categories,
    })

    # Dispatch initial notification
    init_notifications = NotificationDispatcher.dispatch_event(
        request_id=request_id,
        citizen_id=canonical_identifier,
        event_type="initiated",
        status="initiated",
    )
    _emit(request_id, "notifications_dispatched", data={"notifications": init_notifications})

    # ── 1. Identity Resolution ──────────────────────────────────────────────
    try:
        citizen = await lookup_canonical(db, canonical_identifier)
        canonical_id = str(citizen["canonical_id"])
    except Exception as e:
        _emit(request_id, "failed", data={"error": f"Identity resolution failed: {e}"})
        await write_audit(db, actor=actor, action="identity_resolve_failed",
                          request_id=request_id, result_status="failure",
                          metadata={"error": str(e)})
        await _update_orch_status(db, request_id, "failed")
        gil_requests_total.labels(status="failure").inc()
        return {"error": str(e), "status": "failed"}

    _emit(request_id, "identity_resolved", data={"canonical_id": canonical_id})
    await write_audit(db, actor=actor, action="identity_resolved",
                      request_id=request_id, result_status="success",
                      metadata={"canonical_id": canonical_id})

    # ── 2. Determine which systems to call ─────────────────────────────────
    systems_to_call = []
    for category in requested_categories:
        for sys_name, sys_category in SYSTEM_CATEGORY_MAP.items():
            if sys_category == category and sys_name not in systems_to_call:
                systems_to_call.append(sys_name)

    if not systems_to_call:
        systems_to_call = list(SYSTEM_CATEGORY_MAP.keys())

    # ── 3. Consent Checks (per system) ─────────────────────────────────────
    _emit(request_id, "consent_check_started")
    consent_ids: dict[str, str] = {}

    for sys_name in list(systems_to_call):
        category = SYSTEM_CATEGORY_MAP[sys_name]
        try:
            consent_id = await check_consent(db, canonical_id, category)
            consent_ids[sys_name] = consent_id
            await write_audit(db, actor=actor, action="consent_granted",
                              target_system=sys_name, data_category=category,
                              consent_id=consent_id, request_id=request_id,
                              result_status="success")
        except ConsentDeniedError as e:
            log.warning(f"Consent denied for {sys_name}/{category}: {e}")
            gil_consent_denied_total.inc()
            await write_audit(db, actor=actor, action="consent_denied",
                              target_system=sys_name, data_category=category,
                              request_id=request_id, result_status="denied",
                              metadata={"reason": e.reason})
            _emit(request_id, "consent_denied", system=sys_name, data={"reason": e.reason})
            systems_to_call.remove(sys_name)

    _emit(request_id, "consent_checked", data={"approved_systems": systems_to_call})

    # ── 4. Resolve system identifiers ──────────────────────────────────────
    system_ids: dict[str, str] = {}
    for sys_name in list(systems_to_call):
        try:
            sys_id = await resolve_system_id(db, canonical_id, sys_name)
            system_ids[sys_name] = sys_id
        except SystemIdentifierNotFoundError as e:
            log.warning(str(e))
            systems_to_call.remove(sys_name)
            _emit(request_id, "id_not_found", system=sys_name)

    _emit(request_id, "mapped", data={"system_ids": system_ids})

    # ── 5. Fan-out: Concurrent Adapter Calls ───────────────────────────────
    results: dict[str, Any] = {}
    system_statuses: dict[str, dict] = {s: {"stage": "dispatched", "retry_count": 0} for s in systems_to_call}
    await _update_orch_status(db, request_id, "in_progress", system_statuses)

    async def call_system(sys_name: str):
        sys_id = system_ids[sys_name]
        params = {
            "system_identifier": sys_id,
            "canonical_id": canonical_id,
            "request_id": request_id,
        }
        _emit(request_id, "dispatched", system=sys_name, data={"native_id": sys_id})

        attempt_count = 0

        async def do_fetch():
            nonlocal attempt_count
            attempt_count += 1
            t0 = time.time()
            if sys_name == "employment":
                adapter = RestAdapter()
                envelope = await adapter.fetch(params)
            elif sys_name == "skill":
                adapter = SoapAdapter()
                envelope = await adapter.fetch(params)
            elif sys_name == "revenue":
                async with AsyncSessionLocal() as rev_db:
                    adapter = DbAdapter(rev_db)
                    envelope = await adapter.fetch(params)
            else:
                raise AdapterError(sys_name, "Unknown system")
            elapsed = time.time() - t0
            gil_request_latency_seconds.labels(system=sys_name).observe(elapsed)
            return envelope

        try:
            envelope = await with_retry(
                fn=do_fetch,
                system_name=sys_name,
                request_id=request_id,
            )
            results[sys_name] = envelope.canonical_data
            system_statuses[sys_name] = {"stage": "success", "retry_count": attempt_count - 1}
            _emit(request_id, "response_received", system=sys_name)
            async with AsyncSessionLocal() as audit_db:
                await write_audit(
                    audit_db, actor=actor, action="fetch_success",
                    target_system=sys_name,
                    data_category=SYSTEM_CATEGORY_MAP[sys_name],
                    consent_id=consent_ids.get(sys_name),
                    request_id=request_id, result_status="success",
                    metadata={"system_identifier": sys_id},
                )

        except RetryExhaustedError as exc:
            system_statuses[sys_name] = {"stage": "manual_review", "retry_count": settings.retry_max_attempts}
            _emit(request_id, "manual_review", system=sys_name, data={"error": exc.last_error})
            async with AsyncSessionLocal() as exc_db:
                await push_to_manual_review(
                    db=exc_db,
                    request_id=request_id,
                    system_name=sys_name,
                    retry_count=exc.attempts,
                    error_trace=exc.last_error,
                    request_payload=params,
                )
                gil_manual_review_queue_depth.inc()
                await write_audit(
                    exc_db, actor=actor, action="fetch_manual_review",
                    target_system=sys_name, request_id=request_id,
                    result_status="manual_review",
                    metadata={"attempts": exc.attempts, "error": exc.last_error},
                )
            results[sys_name] = {"error": "system_unavailable", "status": "manual_review"}

    # Run all system calls concurrently (fan-out)
    await asyncio.gather(*[call_system(s) for s in systems_to_call])

    # ── 6. Aggregate Results & Data Quality Evaluation ──────────────────────
    _emit(request_id, "aggregated")
    merged: dict[str, Any] = {}
    for sys_data in results.values():
        if isinstance(sys_data, dict) and "error" not in sys_data:
            merged.update(sys_data)

    # Run Data Quality Checks
    quality_report = DataQualityValidator.validate_record(
        canonical_data=merged,
        system_records=results,
    )
    _emit(request_id, "quality_evaluated", data={
        "quality_score": quality_report["quality_score"],
        "quality_grade": quality_report["quality_grade"],
        "discrepancies": quality_report["discrepancies_count"],
    })
    await write_audit(
        db, actor=actor, action="data_quality_checked",
        request_id=request_id, result_status="success",
        metadata={
            "score": quality_report["quality_score"],
            "grade": quality_report["quality_grade"],
            "discrepancies": quality_report["discrepancies_count"],
        }
    )

    # ── 7. Apply RBAC (response-stage field redaction) ──────────────────────
    role = request.requested_by
    redacted_result, redacted_fields = enforce_rbac(merged, role)
    _emit(request_id, "rbac_applied", data={"redacted_fields": redacted_fields})

    if redacted_fields:
        gil_rbac_redactions_total.labels(role=role).inc()
        await write_audit(
            db, actor=actor, action="field_redacted",
            request_id=request_id, result_status="redacted",
            metadata={"role": role, "redacted_fields": redacted_fields},
        )

    # ── 8. Finalise, SLA Benchmark & Notification Dispatch ──────────────────
    overall = "completed"
    for s_status in system_statuses.values():
        if s_status["stage"] == "manual_review":
            overall = "partial"
            break

    elapsed_total = round(time.time() - start_time, 2)
    sla_metrics = {
        "target_seconds": target_sla,
        "actual_seconds": elapsed_total,
        "compliant": elapsed_total <= target_sla,
        "statutory_standard": "Maharashtra Right to Public Services Act, 2015 Benchmark",
    }

    # Dispatch completion notifications
    final_notifications = NotificationDispatcher.dispatch_event(
        request_id=request_id,
        citizen_id=canonical_identifier,
        event_type="completed",
        status=overall,
        phone=merged.get("phone"),
        email=merged.get("email"),
        details={"sla": sla_metrics, "quality": quality_report.get("quality_grade")},
    )
    all_notifications = init_notifications + final_notifications
    _emit(request_id, "notifications_dispatched", data={"notifications": final_notifications})
    _emit(request_id, overall, data={
        "elapsed_seconds": elapsed_total,
        "sla": sla_metrics,
    })

    # Save detailed metadata in memory and status
    details = {
        "scheme_id": request.scheme_id,
        "scheme_name": scheme_name,
        "data_quality": quality_report,
        "sla_metrics": sla_metrics,
        "notifications": all_notifications,
    }
    _orch_details[request_id] = details

    await _update_orch_status(
        db, request_id, overall, system_statuses,
        result=redacted_result, redacted_fields=redacted_fields,
        meta=details
    )

    await write_audit(
        db, actor=actor, action="orchestration_complete",
        request_id=request_id, result_status=overall,
        metadata={
            "elapsed": elapsed_total,
            "sla": sla_metrics,
            "quality_score": quality_report["quality_score"],
            "scheme": scheme_name,
            "systems": list(systems_to_call),
        },
    )

    gil_requests_total.labels(status="success" if overall == "completed" else "partial").inc()

    return {
        "request_id": request_id,
        "overall_status": overall,
        "requested_by_role": role,
        "systems": system_statuses,
        "result": redacted_result,
        "rbac_redactions": redacted_fields,
        "scheme_id": request.scheme_id,
        "scheme_name": scheme_name,
        "data_quality": quality_report,
        "sla_metrics": sla_metrics,
        "notifications": all_notifications,
    }


async def _update_orch_status(
    db: AsyncSession,
    request_id: str,
    status: str,
    system_statuses: dict | None = None,
    result: dict | None = None,
    redacted_fields: list | None = None,
    meta: dict | None = None,
):
    """Update the orchestration_requests table with current status and meta."""
    try:
        combined_statuses = dict(system_statuses or {})
        if meta:
            combined_statuses["__meta__"] = meta

        await db.execute(
            text("""
                UPDATE orchestration_requests
                SET overall_status = :status,
                    system_statuses = :sys_statuses,
                    result = :result,
                    rbac_redactions = :redacted,
                    completed_at = CASE WHEN :status IN ('completed','partial','failed') THEN NOW() ELSE NULL END
                WHERE request_id = :rid
            """),
            {
                "status": status,
                "sys_statuses": json.dumps(combined_statuses),
                "result": json.dumps(result) if result else None,
                "redacted": redacted_fields or [],
                "rid": request_id,
            },
        )
        await db.commit()
    except Exception as e:
        log.warning(f"Failed to update orch status: {e}")


from config import get_settings
settings = get_settings()
