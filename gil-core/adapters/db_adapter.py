"""
GIL Core — adapters/db_adapter.py
SIH26129 Component: DB Adapter → Revenue Registry (PostgreSQL direct access)

Implements AdapterBase for direct database access to the Revenue Registry.
This demonstrates the third brownfield integration pattern: a legacy system
with no HTTP API, accessed via direct DB connection.

Also implements reconcile() — back-fills citizen_canonical_id in revenue_registry
when a new id_map entry is created (simulates a real reconciliation job).
"""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from adapters.base import AdapterBase, AdapterError
from mapping.engine import map_to_canonical
from models.schemas import CanonicalEnvelope, OperationResult, StatusEnvelope

log = logging.getLogger(__name__)


class DbAdapter(AdapterBase):
    """
    SIH: DbAdapter → Revenue PostgreSQL Registry.
    Demonstrates brownfield DB-direct integration pattern.
    DbAdapter requires an injected AsyncSession (from SQLAlchemy engine).
    """
    system_name = "revenue"

    def __init__(self, db: AsyncSession):
        self.db = db

    async def fetch(self, params: dict[str, Any]) -> CanonicalEnvelope:
        """
        Fetch revenue record by native LP-ID from revenue_registry table.
        params: { system_identifier, canonical_id, request_id }
        """
        system_id = params["system_identifier"]
        canonical_id = params["canonical_id"]
        request_id = params["request_id"]

        log.info(f"[DbAdapter] fetch request_id={request_id} revenue_id={system_id}")

        result = await self.db.execute(
            text("""
                SELECT revenue_id, citizen_canonical_id, land_parcel_id,
                       tax_status, outstanding_amount, last_assessment_date, address
                FROM revenue_registry
                WHERE revenue_id = :revenue_id
            """),
            {"revenue_id": system_id},
        )
        row = result.mappings().fetchone()

        if row is None:
            raise AdapterError(
                self.system_name,
                f"Revenue record {system_id} not found in registry",
                retryable=False,
            )

        raw_data = dict(row)
        # Convert date to string for JSON serialisation
        if raw_data.get("last_assessment_date"):
            raw_data["last_assessment_date"] = str(raw_data["last_assessment_date"])
        if raw_data.get("outstanding_amount") is not None:
            raw_data["outstanding_amount"] = float(raw_data["outstanding_amount"])

        canonical_data = map_to_canonical(self.system_name, raw_data)

        log.info(f"[DbAdapter] fetch success for {system_id}")
        return CanonicalEnvelope(
            canonical_id=canonical_id,
            system_name=self.system_name,
            system_identifier=system_id,
            raw_data=raw_data,
            canonical_data=canonical_data,
            request_id=request_id,
        )

    async def submit(self, params: dict[str, Any]) -> OperationResult:
        """Update a revenue record (e.g. mark tax paid)."""
        system_id = params["system_identifier"]
        request_id = params["request_id"]
        payload = params.get("payload", {})

        try:
            await self.db.execute(
                text("UPDATE revenue_registry SET tax_status=:status, updated_at=NOW() WHERE revenue_id=:id"),
                {"status": payload.get("tax_status", "pending"), "id": system_id},
            )
            await self.db.commit()
            return OperationResult(request_id=request_id, system_name=self.system_name,
                                   status="success", message="Revenue record updated")
        except Exception as e:
            await self.db.rollback()
            raise AdapterError(self.system_name, f"DB write error: {e}", retryable=True)

    async def status(self, request_id: str) -> StatusEnvelope:
        return StatusEnvelope(request_id=request_id, system_name=self.system_name, stage="unknown")

    async def reconcile(self, system_identifier: str, canonical_id: str) -> None:
        """
        SIH: Reconciliation job — back-fills citizen_canonical_id in revenue_registry.
        Called by identity/mdm.py when a new id_map entry is resolved.
        """
        try:
            await self.db.execute(
                text("""
                    UPDATE revenue_registry
                    SET citizen_canonical_id = :canonical_id
                    WHERE revenue_id = :revenue_id AND citizen_canonical_id IS NULL
                """),
                {"canonical_id": canonical_id, "revenue_id": system_identifier},
            )
            await self.db.commit()
            log.info(f"[DbAdapter] reconciled revenue_id={system_identifier} → canonical_id={canonical_id}")
        except Exception as e:
            log.warning(f"[DbAdapter] reconcile failed: {e}")
