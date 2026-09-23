"""
GIL Core — audit/logger.py
SIH26129 Component: Audit Logging (Immutable Append-Only)

Writes structured audit records to the audit_log table.
Append-only enforced by:
  1. SQL RULE on table (no UPDATE/DELETE — defined in init.sql)
  2. Application-level: only INSERT operations performed here
  3. No DELETE method exposed

Audit record structure:
  audit_id, timestamp, actor, action, target_system, data_category,
  payload_hash, consent_id, result_status, request_id, metadata
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Optional
import uuid
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


def _hash_payload(payload: dict) -> str:
    """SHA-256 hash of JSON-serialised payload. Stored in audit; actual payload is NOT stored."""
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


async def write_audit(
    db: AsyncSession,
    actor: str,
    action: str,
    request_id: Optional[str] = None,
    target_system: Optional[str] = None,
    data_category: Optional[str] = None,
    payload: Optional[dict] = None,
    consent_id: Optional[str] = None,
    result_status: str = "success",
    metadata: Optional[dict] = None,
) -> str:
    """
    Append an immutable audit record to audit_log.

    SIH Pipeline stage: after every significant GIL action (fetch, consent check,
    RBAC redaction, manual review creation, etc.).

    Returns audit_id (str).
    """
    audit_id = str(uuid4())
    payload_hash = _hash_payload(payload) if payload else None

    await db.execute(
        text("""
            INSERT INTO audit_log
              (audit_id, actor, action, target_system, data_category,
               payload_hash, consent_id, result_status, request_id, metadata)
            VALUES
              (:audit_id, :actor, :action, :target_system, :data_category,
               :payload_hash, :consent_id, :result_status, :request_id, :metadata)
        """),
        {
            "audit_id": audit_id,
            "actor": actor,
            "action": action,
            "target_system": target_system,
            "data_category": data_category,
            "payload_hash": payload_hash,
            "consent_id": consent_id,
            "result_status": result_status,
            "request_id": request_id,
            "metadata": json.dumps(metadata) if metadata else None,
        },
    )
    await db.commit()
    log.debug(f"Audit written: id={audit_id} actor={actor} action={action} result={result_status}")
    return audit_id


async def get_audit_log(db: AsyncSession, request_id: str) -> list[dict]:
    """Fetch all audit entries for a given request_id (read-only viewer)."""
    result = await db.execute(
        text("""
            SELECT audit_id, timestamp, actor, action, target_system,
                   data_category, payload_hash, consent_id, result_status,
                   request_id, metadata
            FROM audit_log
            WHERE request_id = :rid
            ORDER BY timestamp ASC
        """),
        {"rid": request_id},
    )
    rows = result.mappings().fetchall()
    return [
        {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in r.items()}
        for r in rows
    ]


async def get_audit_by_actor(db: AsyncSession, actor: str, limit: int = 100) -> list[dict]:
    """Fetch recent audit entries for a given actor (citizen or officer)."""
    result = await db.execute(
        text("""
            SELECT audit_id, timestamp, actor, action, target_system,
                   data_category, result_status, request_id
            FROM audit_log
            WHERE actor = :actor
            ORDER BY timestamp DESC
            LIMIT :limit
        """),
        {"actor": actor, "limit": limit},
    )
    return [
        {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in r.items()}
        for r in result.mappings().fetchall()
    ]
