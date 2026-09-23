import pytest
from quality.validator import DataQualityValidator


def test_perfect_quality_record():
    canonical = {
        "canonical_id": "MAHA-2024-001",
        "name": "Priya Sharma",
        "phone": "9876543210",
        "email": "priya.sharma@example.com",
        "dob": "1995-07-14",
    }
    systems = {
        "employment": {"name": "Priya Sharma", "dob": "1995-07-14"},
        "skill": {"name": "Priya Sharma", "dob": "1995-07-14"},
        "revenue": {"name": "Priya Sharma", "dob": "1995-07-14"},
    }
    res = DataQualityValidator.validate_record(canonical, systems)
    assert res["quality_score"] == 100.0
    assert "Grade A" in res["quality_grade"]
    assert res["discrepancies_count"] == 0


def test_cross_registry_discrepancy():
    canonical = {
        "canonical_id": "MAHA-2024-002",
        "name": "Rahul Deshmukh",
        "phone": "9876543211",
        "email": "invalid-email-format",
        "dob": "1992-03-21",
    }
    systems = {
        "employment": {"name": "Rahul Deshmukh", "dob": "1992-03-21"},
        "revenue": {"name": "Rahul Deshmukh", "dob": "1992-04-21"},  # Discrepancy in DOB!
    }
    res = DataQualityValidator.validate_record(canonical, systems)
    assert res["discrepancies_count"] > 0
    assert res["quality_score"] < 100.0
    assert any(d["field"] == "dob" for d in res["discrepancies"])
