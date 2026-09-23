"""
Mock Employment System — data.py
SIH26129 GIL: Modern REST departmental system (brownfield integration target)

In-memory seeded data keyed by NATIVE system identifier (EMP-xxxx).
Date format is DD/MM/YYYY — intentional mismatch; GIL mapping engine transforms it.
"""

EMPLOYEES: dict[str, dict] = {
    "EMP-7789": {
        "emp_id": "EMP-7789",
        "full_name": "Priya Sharma",
        "date_of_birth": "14/07/1995",       # DD/MM/YYYY — mapping engine converts to ISO8601
        "mobile_no": "9876543210",
        "email_address": "priya.sharma@example.com",
        "employment_status": "employed",
        "department_code": "MFGD-04",
        "designation": "Junior Engineer",
        "joining_date": "01/03/2020",
        "monthly_salary": 38000.00,
        "aadhaar_ref": "XXXX-XXXX-7799",     # masked reference only (no actual Aadhaar stored)
        "employer_name": "Tata AutoComp Systems Ltd",
        "district": "Pune",
        "state": "Maharashtra",
    },
    "EMP-4421": {
        "emp_id": "EMP-4421",
        "full_name": "Rahul Deshmukh",
        "date_of_birth": "22/03/1988",
        "mobile_no": "9823001122",
        "email_address": "rahul.deshmukh@example.com",
        "employment_status": "unemployed",
        "department_code": None,
        "designation": None,
        "joining_date": None,
        "monthly_salary": 0.00,
        "aadhaar_ref": "XXXX-XXXX-4401",
        "employer_name": None,
        "district": "Nashik",
        "state": "Maharashtra",
    },
}
