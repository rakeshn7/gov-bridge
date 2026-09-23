"""
GIL Core — tests/unit/test_rbac.py
SIH26129: Unit tests for RBAC enforcer (response-stage field redaction)
"""
import pytest
from rbac.enforcer import enforce_rbac, get_visible_fields


class TestGetVisibleFields:
    def test_gilservice_sees_all(self):
        fields = get_visible_fields("GILService")
        assert "*" in fields

    def test_unknown_role_sees_nothing(self):
        fields = get_visible_fields("UnknownRole")
        assert fields == []

    def test_skill_officer_has_limited_fields(self):
        fields = get_visible_fields("SkillDeptOfficer")
        assert "name" in fields
        assert "skills" in fields
        # Income fields should NOT be visible
        assert "monthly_income" not in fields


class TestEnforceRbac:
    CANONICAL_DATA = {
        "name": "Priya Sharma",
        "dob": "1995-07-14",
        "phone": "9876543210",
        "email": "priya@example.com",
        "employment_status": "employed",
        "monthly_income": 38000.0,
        "skills": ["Welding L2"],
        "certifications": [],
        "tax_status": "paid",
        "outstanding_amount": 0.0,
        "land_parcel_id": "PARCEL-MH-4410",
    }

    def test_gilservice_no_redaction(self):
        result, redacted = enforce_rbac(self.CANONICAL_DATA, "GILService")
        assert redacted == []
        assert result["monthly_income"] == 38000.0

    def test_skill_officer_redacts_income_and_revenue(self):
        result, redacted = enforce_rbac(self.CANONICAL_DATA, "SkillDeptOfficer")
        assert "monthly_income" in redacted
        assert "tax_status" in redacted
        assert "outstanding_amount" in redacted
        assert result["monthly_income"] == "<redacted>"
        assert result["name"] == "Priya Sharma"  # visible to SkillDeptOfficer

    def test_revenue_officer_redacts_income(self):
        result, redacted = enforce_rbac(self.CANONICAL_DATA, "RevenueDeptOfficer")
        assert "monthly_income" in redacted
        assert "tax_status" in result
        assert result["tax_status"] == "paid"

    def test_two_stage_model_confirmed(self):
        # RBAC only redacts; it does NOT deny the entire request.
        # Even SkillDeptOfficer gets a result (with redactions, not a 403).
        result, redacted = enforce_rbac(self.CANONICAL_DATA, "SkillDeptOfficer")
        assert isinstance(result, dict)
        assert len(result) == len(self.CANONICAL_DATA)  # all keys present, some redacted
