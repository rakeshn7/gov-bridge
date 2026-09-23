"""
GIL Core — identity/mdm.py
SIH26129 Component: Identity Mapping / MDM (Master Data Management)

Resolves canonical citizen IDs ↔ system-native identifiers using the id_map table.

Functions:
  lookup_canonical       — get canonical citizen from canonical_identifier (MAHA-xxx)
  resolve_system_id      — get native system ID for a given system from canonical_id
  resolve_all_system_ids — get all system identifiers for a canonical citizen
  create_citizen         — insert new canonical citizen + id_map entries
"""

import logging
import uuid
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

log = logging.getLogger(__name__)


class CitizenNotFoundError(Exception):
    pass


class SystemIdentifierNotFoundError(Exception):
    pass


async def lookup_canonical(db: AsyncSession, canonical_identifier: str) -> dict:
    """
    Resolve canonical citizen record by canonical_identifier (e.g. 'MAHA-2024-001').
    Returns full citizen dict including canonical_id (UUID).
    Raises CitizenNotFoundError if not found.
    """
    result = await db.execute(
        text("SELECT canonical_id, name, dob, canonical_identifier FROM canonical_citizens WHERE canonical_identifier = :cid"),
        {"cid": canonical_identifier},
    )
    row = result.mappings().fetchone()
    if row is None:
        raise CitizenNotFoundError(f"Canonical citizen not found: {canonical_identifier}")
    return dict(row)


async def resolve_system_id(
    db: AsyncSession, canonical_id: str, system_name: str
) -> str:
    """
    Get the native system identifier for a citizen in a specific system.
    e.g. canonical_id(Priya) + 'employment' → 'EMP-7789'
    Raises SystemIdentifierNotFoundError if no mapping exists.
    """
    result = await db.execute(
        text("""
            SELECT system_identifier FROM id_map
            WHERE canonical_id = :cid AND system_name = :sname
        """),
        {"cid": canonical_id, "sname": system_name},
    )
    row = result.fetchone()
    if row is None:
        raise SystemIdentifierNotFoundError(
            f"No id_map entry for canonical_id={canonical_id} system={system_name}"
        )
    return row[0]


async def resolve_all_system_ids(db: AsyncSession, canonical_id: str) -> dict[str, str]:
    """
    Get all system identifiers for a canonical citizen.
    Returns: { 'employment': 'EMP-7789', 'skill': 'SK-2031', 'revenue': 'LP-3301' }
    """
    result = await db.execute(
        text("SELECT system_name, system_identifier FROM id_map WHERE canonical_id = :cid"),
        {"cid": canonical_id},
    )
    rows = result.fetchall()
    return {row[0]: row[1] for row in rows}


async def create_citizen(
    db: AsyncSession,
    name: str,
    dob: Optional[str],
    canonical_identifier: str,
    system_mappings: dict[str, str],  # { 'employment': 'EMP-xxx', ... }
) -> str:
    """
    Create a new canonical citizen and their system identifier mappings.
    Returns the new canonical_id (UUID string).
    """
    canonical_id = str(uuid.uuid4())
    await db.execute(
        text("""
            INSERT INTO canonical_citizens (canonical_id, name, dob, canonical_identifier)
            VALUES (:cid, :name, :dob, :ci)
        """),
        {"cid": canonical_id, "name": name, "dob": dob, "ci": canonical_identifier},
    )
    for system_name, system_identifier in system_mappings.items():
        await db.execute(
            text("INSERT INTO id_map (canonical_id, system_name, system_identifier) VALUES (:cid, :sname, :sid)"),
            {"cid": canonical_id, "sname": system_name, "sid": system_identifier},
        )
    await db.commit()
    log.info(f"Created canonical citizen {canonical_identifier} → {canonical_id}")
    return canonical_id
