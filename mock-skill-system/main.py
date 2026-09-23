"""
Mock Skill Development System — main.py
SIH26129 GIL Component: Legacy SOAP/XML API (brownfield target system)

Endpoints:
  GET  /health                  — liveness check
  POST /soap                    — SOAP envelope handler (actions: GetSkills, SubmitSkillCheck)
  POST /admin/toggle-failure    — deterministic failure simulation

SOAP actions supported:
  - GetSkills: returns skill certifications for a given SK-ID
  - SubmitSkillCheck: accepts a skill assessment submission, returns acknowledgement

Simulates realistic SOAP latency (200–800ms) to demonstrate async orchestration.
"""

import os
import asyncio
import logging
import random
import re
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response as FastAPIResponse
import jwt

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","svc":"mock-skill","msg":"%(message)s"}'
)
log = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────
SERVICE_JWT_SECRET = os.environ.get("SERVICE_JWT_SECRET", "service-secret-key-dev")
PORT = int(os.environ.get("PORT", "8002"))
FAILURE_MODE: bool = False

# ─── In-memory skill data keyed by native SK-ID ───────────────────────────────
SKILL_DATA: dict[str, dict] = {
    "SK-2031": {
        "sk_id": "SK-2031",
        "candidate_name": "Priya Sharma",
        "date_of_birth": "14/07/1995",
        "skills": ["Welding L2", "AutoCAD", "Quality Control"],
        "certifications": [
            {"cert_id": "NSDC-2023-4410", "name": "Welding Level 2", "issued_date": "15/06/2023", "issuer": "NSDC"},
            {"cert_id": "MSME-2022-0081", "name": "AutoCAD Proficiency", "issued_date": "20/11/2022", "issuer": "MSME"},
        ],
        "training_hours": 420,
        "assessment_score": 87.5,
        "district": "Pune",
    },
    "SK-0897": {
        "sk_id": "SK-0897",
        "candidate_name": "Rahul Deshmukh",
        "date_of_birth": "22/03/1988",
        "skills": ["Electrical Wiring", "PLC Programming"],
        "certifications": [
            {"cert_id": "NSDC-2021-1103", "name": "Electrical Installation", "issued_date": "10/04/2021", "issuer": "NSDC"},
        ],
        "training_hours": 280,
        "assessment_score": 74.0,
        "district": "Nashik",
    },
}

# ─── SOAP XML helpers ─────────────────────────────────────────────────────────

def _soap_envelope(body_xml: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:skl="http://maharashtra.gov.in/skill/v1">
  <soapenv:Header/>
  <soapenv:Body>
    {body_xml}
  </soapenv:Body>
</soapenv:Envelope>"""


def _soap_fault(code: str, message: str) -> str:
    return _soap_envelope(f"""
    <soapenv:Fault>
      <faultcode>{code}</faultcode>
      <faultstring>{message}</faultstring>
    </soapenv:Fault>""")


def _get_skills_response(sk_id: str) -> str:
    data = SKILL_DATA.get(sk_id)
    if not data:
        return _soap_fault("skl:NotFound", f"No skill record for SK-ID: {sk_id}")

    certs_xml = ""
    for c in data["certifications"]:
        certs_xml += f"""
        <skl:Certification>
          <skl:CertId>{c['cert_id']}</skl:CertId>
          <skl:Name>{c['name']}</skl:Name>
          <skl:IssuedDate>{c['issued_date']}</skl:IssuedDate>
          <skl:Issuer>{c['issuer']}</skl:Issuer>
        </skl:Certification>"""

    skills_xml = "".join(f"<skl:Skill>{s}</skl:Skill>" for s in data["skills"])

    return _soap_envelope(f"""
    <skl:GetSkillsResponse>
      <skl:SkId>{sk_id}</skl:SkId>
      <skl:CandidateName>{data['candidate_name']}</skl:CandidateName>
      <skl:DateOfBirth>{data['date_of_birth']}</skl:DateOfBirth>
      <skl:TrainingHours>{data['training_hours']}</skl:TrainingHours>
      <skl:AssessmentScore>{data['assessment_score']}</skl:AssessmentScore>
      <skl:District>{data['district']}</skl:District>
      <skl:SkillList>{skills_xml}</skl:SkillList>
      <skl:CertificationList>{certs_xml}</skl:CertificationList>
    </skl:GetSkillsResponse>""")


def _submit_skill_check_response(sk_id: str, assessment_type: str) -> str:
    import uuid
    ack_id = f"ACK-{uuid.uuid4().hex[:8].upper()}"
    return _soap_envelope(f"""
    <skl:SubmitSkillCheckResponse>
      <skl:AcknowledgementId>{ack_id}</skl:AcknowledgementId>
      <skl:SkId>{sk_id}</skl:SkId>
      <skl:AssessmentType>{assessment_type}</skl:AssessmentType>
      <skl:Status>ACCEPTED</skl:Status>
      <skl:Message>Skill check submission received and queued for processing.</skl:Message>
    </skl:SubmitSkillCheckResponse>""")


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Mock Skill Development System",
    description="SIH26129 GIL — Brownfield target: legacy SOAP/XML departmental system",
    version="1.0.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def verify_service_jwt(authorization: Optional[str] = Header(None)) -> dict:
    """Validate GIL service-to-service JWT."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SERVICE_JWT_SECRET, algorithms=["HS256"])
        if payload.get("role") != "GILService":
            raise HTTPException(status_code=403, detail="Insufficient role")
        return payload
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid service token: {e}")


@app.get("/health")
async def health():
    return {
        "status": "healthy" if not FAILURE_MODE else "degraded",
        "service": "mock-skill",
        "failure_mode": FAILURE_MODE,
        "candidate_count": len(SKILL_DATA),
    }


@app.post("/soap")
async def soap_handler(request: Request, _: dict = Depends(verify_service_jwt)):
    """
    SIH: SOAP/XML legacy system connector target.
    Parses SOAP action from SOAPAction header or XML body.
    Simulates 200–800ms realistic legacy system latency.
    """
    if FAILURE_MODE:
        fault_xml = _soap_fault("skl:ServiceUnavailable", "Skill system temporarily unavailable (simulated failure)")
        return FastAPIResponse(content=fault_xml, media_type="text/xml", status_code=503)

    # Simulated legacy latency
    await asyncio.sleep(random.uniform(0.2, 0.8))

    body = await request.body()
    body_str = body.decode("utf-8")

    # Extract SOAPAction from header or infer from body
    soap_action = request.headers.get("SOAPAction", "").strip('"')
    if not soap_action:
        if "GetSkills" in body_str:
            soap_action = "GetSkills"
        elif "SubmitSkillCheck" in body_str:
            soap_action = "SubmitSkillCheck"

    # Extract SK-ID from body
    sk_match = re.search(r"<(?:\w+:)?SkId>(.*?)</(?:\w+:)?SkId>", body_str)
    sk_id = sk_match.group(1).strip() if sk_match else None

    log.info(f"SOAP action={soap_action} sk_id={sk_id}")

    if soap_action == "GetSkills":
        if not sk_id:
            resp = _soap_fault("skl:MissingParameter", "SkId is required for GetSkills")
        else:
            resp = _get_skills_response(sk_id)

    elif soap_action == "SubmitSkillCheck":
        assessment_match = re.search(r"<(?:\w+:)?AssessmentType>(.*?)</(?:\w+:)?AssessmentType>", body_str)
        assessment_type = assessment_match.group(1) if assessment_match else "GENERAL"
        resp = _submit_skill_check_response(sk_id or "UNKNOWN", assessment_type)

    else:
        resp = _soap_fault("soapenv:Client", f"Unknown SOAP action: {soap_action}")

    return FastAPIResponse(content=resp, media_type="text/xml")


@app.post("/admin/toggle-failure")
async def toggle_failure():
    """SIH: Simulate-failure toggle — deterministic failure for demo."""
    global FAILURE_MODE
    FAILURE_MODE = not FAILURE_MODE
    status = "ENABLED" if FAILURE_MODE else "DISABLED"
    log.warning(f"Skill system failure mode {status}")
    return {"failure_mode": FAILURE_MODE, "message": f"Skill system failure simulation {status}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
