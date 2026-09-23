"""
GIL Core — tests/integration/test_e2e.py
SIH26129: End-to-end integration tests

Requires docker-compose stack to be running:
  docker-compose up -d
  # wait for services to be healthy
  pytest tests/integration/test_e2e.py -v

Tests:
  1. Successful full-flow: citizen MAHA-2024-001 → consolidates 3 system responses
  2. Failure flow: toggle employment failure → verify manual_review created
  3. Consent denial: revoke consent → verify adapter.fetch blocked
  4. RBAC: SkillDeptOfficer request → verify monthly_income is redacted
  5. Audit log: verify audit entries written for successful flow
"""

import asyncio
import time
import httpx
import pytest

import os

GIL_BASE = os.getenv("GIL_BASE_URL", "http://localhost:8000")
EMPLOYMENT_BASE = os.getenv("EMPLOYMENT_API_URL", "http://localhost:8001")
SKILL_BASE = os.getenv("SKILL_API_URL", "http://localhost:8002")

# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_citizen_token(role: str = "GILService") -> str:
    resp = httpx.post(f"{GIL_BASE}/auth/token", json={
        "username": "MAHA-2024-001",
        "password": "demo",
        "role": role,
    })
    resp.raise_for_status()
    return resp.json()["access_token"]


def auth_header(role: str = "GILService") -> dict:
    return {"Authorization": f"Bearer {get_citizen_token(role)}"}


def wait_for_completion(request_id: str, token: str, timeout: int = 60) -> dict:
    """Poll /status until completed or failed."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        resp = httpx.get(
            f"{GIL_BASE}/api/v1/requests/{request_id}/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 200:
            data = resp.json()
            if data["overall_status"] in ("completed", "partial", "failed"):
                return data
        time.sleep(1)
    raise TimeoutError(f"Orchestration {request_id} did not complete in {timeout}s")


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestHealthChecks:
    def test_gil_health(self):
        resp = httpx.get(f"{GIL_BASE}/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_employment_health(self):
        resp = httpx.get(f"{EMPLOYMENT_BASE}/health")
        assert resp.status_code == 200

    def test_skill_health(self):
        resp = httpx.get(f"{SKILL_BASE}/health")
        assert resp.status_code == 200

    def test_gil_metrics(self):
        resp = httpx.get(f"{GIL_BASE}/metrics")
        assert resp.status_code == 200
        assert "gil_requests_total" in resp.text


class TestE2ESuccessFlow:
    """
    Acceptance Criterion #1: E2E consolidation of three system responses.
    Seeded citizen MAHA-2024-001 → EMP-7789 / SK-2031 / LP-3301.
    """

    def test_full_flow_consolidates_three_systems(self):
        token = get_citizen_token("GILService")
        resp = httpx.post(
            f"{GIL_BASE}/api/v1/requests",
            json={
                "citizen_id": "MAHA-2024-001",
                "data_categories": ["employment", "skills", "revenue"],
                "purpose": "e2e_test",
                "requested_by": "GILService",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 202
        request_id = resp.json()["request_id"]

        status = wait_for_completion(request_id, token, timeout=90)
        assert status["overall_status"] in ("completed", "partial")
        assert status["result"] is not None
        # Should have employment data
        assert "name" in status["result"]
        assert status["result"]["name"] == "Priya Sharma"


class TestRBACRedaction:
    """
    Acceptance Criterion #6: RBAC enforcer redacts unauthorized fields.
    SkillDeptOfficer should see skills but NOT monthly_income or tax_status.
    """

    def test_skill_officer_gets_redacted_response(self):
        token = get_citizen_token("SkillDeptOfficer")
        resp = httpx.post(
            f"{GIL_BASE}/api/v1/requests",
            json={
                "citizen_id": "MAHA-2024-001",
                "data_categories": ["employment", "skills", "revenue"],
                "purpose": "rbac_test",
                "requested_by": "SkillDeptOfficer",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 202
        request_id = resp.json()["request_id"]

        status = wait_for_completion(request_id, token, timeout=90)
        result = status.get("result", {})
        redactions = status.get("rbac_redactions", [])

        # Income and revenue fields should be redacted for SkillDeptOfficer
        assert "monthly_income" in redactions or result.get("monthly_income") == "<redacted>"


class TestConsentDenial:
    """
    Acceptance Criterion #5: Consent check denies adapter.fetch when consent revoked.
    """

    def test_revoked_consent_blocks_fetch(self):
        token = get_citizen_token("GILService")
        # Revoke Rahul's consent
        httpx.post(f"{GIL_BASE}/api/v1/consent", json={
            "citizen_id": "MAHA-2024-002",
            "data_categories": [],
            "revoke": True,
            "granted_by": "test",
        }, headers={"Authorization": f"Bearer {token}"})

        resp = httpx.post(
            f"{GIL_BASE}/api/v1/requests",
            json={
                "citizen_id": "MAHA-2024-002",
                "data_categories": ["employment", "skills", "revenue"],
                "purpose": "consent_test",
                "requested_by": "GILService",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 202
        request_id = resp.json()["request_id"]
        status = wait_for_completion(request_id, token, timeout=60)
        # With all consent revoked, result should be empty or partial
        result = status.get("result") or {}
        # No real data fields should be present
        actual_data_fields = {k: v for k, v in result.items() if v not in (None, "<redacted>", "")}
        assert len(actual_data_fields) == 0 or status["overall_status"] in ("partial", "failed")

        # Re-grant consent for subsequent tests
        httpx.post(f"{GIL_BASE}/api/v1/consent", json={
            "citizen_id": "MAHA-2024-002",
            "data_categories": ["employment", "skills", "revenue"],
            "revoke": False,
            "granted_by": "test-restore",
        }, headers={"Authorization": f"Bearer {token}"})


class TestFailureToManualReview:
    """
    Acceptance Criterion #4: Retry policy exercised; manual_review created on exhaustion.
    """

    def test_failure_creates_manual_review(self):
        token = get_citizen_token("GILService")
        # Enable failure mode on employment
        httpx.post(f"{EMPLOYMENT_BASE}/admin/toggle-failure")

        resp = httpx.post(
            f"{GIL_BASE}/api/v1/requests",
            json={
                "citizen_id": "MAHA-2024-001",
                "data_categories": ["employment"],
                "purpose": "failure_test",
                "requested_by": "GILService",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 202
        request_id = resp.json()["request_id"]

        # Wait for retries to exhaust (3 attempts × 2s delay + backoff ≈ 14s)
        status = wait_for_completion(request_id, token, timeout=90)

        # System should be in manual_review state
        emp_status = status.get("systems", {}).get("employment", {})
        assert emp_status.get("stage") == "manual_review"

        # Verify record in Postgres manual_review_queue
        mr_resp = httpx.get(f"{GIL_BASE}/api/v1/manual-review",
                             headers={"Authorization": f"Bearer {token}"})
        assert mr_resp.status_code == 200
        items = mr_resp.json()["items"]
        matching = [i for i in items if i["request_id"] == request_id]
        assert len(matching) >= 1

        # Restore employment system
        httpx.post(f"{EMPLOYMENT_BASE}/admin/toggle-failure")


class TestAuditLog:
    """
    Acceptance Criterion #3: Immutable audit log entry per cross-system interaction.
    """

    def test_audit_entries_created_for_flow(self):
        token = get_citizen_token("GILService")
        resp = httpx.post(
            f"{GIL_BASE}/api/v1/requests",
            json={
                "citizen_id": "MAHA-2024-001",
                "data_categories": ["employment"],
                "purpose": "audit_test",
                "requested_by": "GILService",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        request_id = resp.json()["request_id"]
        wait_for_completion(request_id, token, timeout=60)

        audit_resp = httpx.get(
            f"{GIL_BASE}/api/v1/audit/{request_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert audit_resp.status_code == 200
        entries = audit_resp.json()["entries"]
        assert len(entries) >= 2  # At minimum: identity_resolved + fetch_success/failure
        actions = [e["action"] for e in entries]
        assert "identity_resolved" in actions
