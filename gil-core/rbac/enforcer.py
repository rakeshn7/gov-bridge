"""
GIL Core — rbac/enforcer.py
SIH26129 Component: RBAC Policy Enforcer (response-stage field redaction)

IMPORTANT — Two-Stage Model:
  Stage 1 (FETCH): Governed by CONSENT — consent/manager.py checks whether the
                   orchestrator may call adapter.fetch() at all.
  Stage 2 (RESPONSE): Governed by RBAC — this module redacts fields the requesting
                      role is not permitted to SEE in the response.

Redacted fields are replaced with '<redacted>' in the API response.
Each redaction is logged in the audit record with action='field_redacted'.
"""

import json
import logging
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

POLICY_PATH = Path(__file__).parent / "policy.json"
_policy_cache: dict | None = None


def _load_policy() -> dict:
    global _policy_cache
    if _policy_cache is None:
        with open(POLICY_PATH) as f:
            _policy_cache = json.load(f)
    return _policy_cache


def get_visible_fields(role: str) -> list[str]:
    """Return the list of visible field names for a role. ['*'] means all fields."""
    policy = _load_policy()
    role_policy = policy.get("roles", {}).get(role)
    if role_policy is None:
        log.warning(f"RBAC: unknown role '{role}' — denying all fields")
        return []
    return role_policy.get("visible_fields", [])


def enforce_rbac(
    canonical_data: dict[str, Any],
    role: str,
) -> tuple[dict[str, Any], list[str]]:
    """
    Apply RBAC to the aggregated canonical response.

    Args:
        canonical_data: merged canonical fields from all adapters
        role: requesting role (from JWT claims)

    Returns:
        (redacted_data, redacted_field_names)
        redacted_data: canonical_data with unauthorised fields replaced by '<redacted>'
        redacted_field_names: list of field names that were redacted (for audit)
    """
    visible = get_visible_fields(role)

    # Wildcard — role sees everything
    if "*" in visible:
        return canonical_data, []

    redacted_data = {}
    redacted_fields = []

    for field, value in canonical_data.items():
        if field in visible:
            redacted_data[field] = value
        else:
            redacted_data[field] = "<redacted>"
            redacted_fields.append(field)

    if redacted_fields:
        log.info(f"RBAC redacted {len(redacted_fields)} fields for role={role}: {redacted_fields}")

    return redacted_data, redacted_fields
