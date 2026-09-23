"""
GIL Core — tests/unit/test_mapping.py
SIH26129: Unit tests for schema mapping engine
"""
import pytest
from mapping.engine import map_to_canonical, _apply_transform, _cast_type


class TestTransforms:
    def test_date_format_ddmmyyyy_to_iso(self):
        result = _apply_transform("14/07/1995", "date_format", {"from": "%d/%m/%Y", "to": "ISO8601"})
        assert result == "1995-07-14"

    def test_date_format_invalid_returns_original(self):
        result = _apply_transform("not-a-date", "date_format", {"from": "%d/%m/%Y", "to": "ISO8601"})
        assert result == "not-a-date"

    def test_date_format_none_returns_none(self):
        assert _apply_transform(None, "date_format", {}) is None

    def test_hash_sha256(self):
        result = _apply_transform("XXXX-XXXX-7799", "hash_sha256", {})
        assert len(result) == 64  # SHA-256 hex digest
        assert isinstance(result, str)

    def test_hash_sha256_none(self):
        assert _apply_transform(None, "hash_sha256", {}) is None

    def test_upper(self):
        assert _apply_transform("hello", "upper", {}) == "HELLO"

    def test_lower(self):
        assert _apply_transform("WORLD", "lower", {}) == "world"


class TestTypeCasts:
    def test_string_cast(self):
        assert _cast_type(123, "string") == "123"

    def test_float_cast(self):
        assert _cast_type("38000", "float") == 38000.0

    def test_int_cast(self):
        assert _cast_type("420", "int") == 420

    def test_none_returns_none(self):
        assert _cast_type(None, "string") is None


class TestMapToCanonical:
    def test_employment_mapping(self):
        native = {
            "emp_id": "EMP-7789",
            "full_name": "Priya Sharma",
            "date_of_birth": "14/07/1995",
            "mobile_no": "9876543210",
            "email_address": "priya@example.com",
            "employment_status": "employed",
            "department_code": "MFGD-04",
            "designation": "Junior Engineer",
            "joining_date": "01/03/2020",
            "monthly_salary": 38000.0,
            "aadhaar_ref": "XXXX-XXXX-7799",
            "employer_name": "Tata AutoComp",
            "district": "Pune",
            "state": "Maharashtra",
        }
        canonical = map_to_canonical("employment", native)
        assert canonical["name"] == "Priya Sharma"
        assert canonical["dob"] == "1995-07-14"          # date transformed
        assert canonical["system_identifier"] == "EMP-7789"
        assert len(canonical["aadhaar_hash"]) == 64       # SHA-256 applied
        assert canonical["monthly_income"] == 38000.0

    def test_revenue_mapping(self):
        native = {
            "revenue_id": "LP-3301",
            "land_parcel_id": "PARCEL-MH-4410",
            "tax_status": "paid",
            "outstanding_amount": 0.0,
            "last_assessment_date": "2024-01-15",
            "address": "Flat 3B, Pune",
        }
        canonical = map_to_canonical("revenue", native)
        assert canonical["system_identifier"] == "LP-3301"
        assert canonical["tax_status"] == "paid"
        assert canonical["outstanding_amount"] == 0.0
