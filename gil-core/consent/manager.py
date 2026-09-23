"""
GIL Core — consent/manager.py
SIH26129 Component: Consent Management

Checks citizen consent before any adapter.fetch() call.
Consent governs FETCH authorization (not RBAC, which governs response visibility).

Consent table columns:
  citizen_id, data_categories (TEXT[]), granted_until, revoked, granted_by

check_consent() raises ConsentDeniedError if:
  - No active consent record exists
  - Consent has been revoked
  - Consent has expired (granted_until < NOW())
  - Requested data_category not in consent.data_categories
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


class ConsentDeniedError(Exception):
    def __init__(self, citizen_id: str, data_category: str, reason: str):
        self.citizen_id = citizen_id
        self.data_category = data_category
        self.reason = reason
        super().__init__(f"Consent denied for {citizen_id}/{data_category}: {reason}")


async def check_consent(
    db: AsyncSession,
    citizen_id: str,     # canonical_id (UUID)
    data_category: str,
) -> str:
    """
    Check that an active, non-expired, non-revoked consent covers the requested data_category.

    Returns consent_id (str) on success.
    Raises ConsentDeniedError on failure.
    """
    result = await db.execute(
        text("""
            SELECT consent_id, data_categories, granted_until, revoked
            FROM consent
            WHERE citizen_id = :cid
              AND :category = ANY(data_categories)
              AND revoked = FALSE
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"cid": citizen_id, "category": data_category},
    )
    row = result.mappings().fetchone()

    if row is None:
        raise ConsentDeniedError(citizen_id, data_category, "No active consent record for this data category")

    if row["revoked"]:
        raise ConsentDeniedError(citizen_id, data_category, "Consent has been revoked")

    if row["granted_until"] and row["granted_until"] < datetime.now(tz=timezone.utc):
        raise ConsentDeniedError(citizen_id, data_category, "Consent has expired")

    consent_id = str(row["consent_id"])
    log.info(f"Consent granted citizen={citizen_id} category={data_category} consent_id={consent_id}")
    return consent_id


async def get_all_consented_categories(db: AsyncSession, citizen_id: str) -> list[str]:
    """Return all active data categories the citizen has consented to."""
    result = await db.execute(
        text("""
            SELECT UNNEST(data_categories) AS category
            FROM consent
            WHERE citizen_id = :cid AND revoked = FALSE
              AND (granted_until IS NULL OR granted_until > NOW())
        """),
        {"cid": citizen_id},
    )
    return [row[0] for row in result.fetchall()]


async def revoke_consent(db: AsyncSession, citizen_id: str) -> int:
    """Revoke all active consent for a citizen. Returns count of revoked records."""
    result = await db.execute(
        text("UPDATE consent SET revoked = TRUE WHERE citizen_id = :cid AND revoked = FALSE"),
        {"cid": citizen_id},
    )
    await db.commit()
    count = result.rowcount
    log.warning(f"Revoked {count} consent record(s) for citizen={citizen_id}")
    return count


async def grant_consent(
    db: AsyncSession,
    citizen_id: str,
    data_categories: list[str],
    granted_by: str = "citizen-self",
    days_valid: int = 30,
) -> str:
    """Grant new consent and return the new consent_id."""
    result = await db.execute(
        text("""
            INSERT INTO consent (citizen_id, data_categories, granted_until, granted_by)
            VALUES (:cid, :cats, NOW() + :days * INTERVAL '1 day', :by)
            RETURNING consent_id
        """),
        {"cid": citizen_id, "cats": data_categories, "days": days_valid, "by": granted_by},
    )
    await db.commit()
    consent_id = str(result.scalar())
    log.info(f"Granted consent citizen={citizen_id} categories={data_categories} id={consent_id}")
    return consent_id
