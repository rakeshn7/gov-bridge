"""
GIL Core — adapters/soap_adapter.py
SIH26129 Component: SOAP Adapter → Skill Development System (FastAPI :8002)

Implements AdapterBase for a legacy SOAP/XML departmental system.
Sends SOAP envelopes and parses XML responses into canonical dict.
Demonstrates brownfield integration with heterogeneous protocol.
"""

import logging
import re
from datetime import datetime
from typing import Any

import httpx

from adapters.base import AdapterBase, AdapterError
from auth.jwt_utils import create_service_token
from mapping.engine import map_to_canonical
from models.schemas import CanonicalEnvelope, OperationResult, StatusEnvelope
from config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()


def _build_get_skills_envelope(sk_id: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
    xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:skl="http://maharashtra.gov.in/skill/v1">
  <soapenv:Header/>
  <soapenv:Body>
    <skl:GetSkillsRequest>
      <skl:SkId>{sk_id}</skl:SkId>
    </skl:GetSkillsRequest>
  </soapenv:Body>
</soapenv:Envelope>"""


def _parse_soap_to_dict(xml_text: str) -> dict:
    """
    Minimal XML→dict parser for Skill SOAP responses.
    SIH: Schema Mapping — XML→JSON transform step.
    """
    def get_text(tag: str) -> Any:
        # Strip namespace prefix when searching
        m = re.search(rf"<(?:\w+:)?{tag}>(.*?)</(?:\w+:)?{tag}>", xml_text, re.DOTALL)
        return m.group(1).strip() if m else None

    # Check for SOAP fault
    if "<soapenv:Fault>" in xml_text or "<faultstring>" in xml_text:
        fault_msg = get_text("faultstring") or "Unknown SOAP fault"
        raise AdapterError("skill", f"SOAP fault: {fault_msg}", retryable=False)

    # Extract skill list
    skills_block = re.search(r"<(?:\w+:)?SkillList>(.*?)</(?:\w+:)?SkillList>", xml_text, re.DOTALL)
    skills = []
    if skills_block:
        skills = re.findall(r"<(?:\w+:)?Skill>(.*?)</(?:\w+:)?Skill>", skills_block.group(1), re.DOTALL)

    # Extract certifications
    cert_blocks = re.findall(r"<(?:\w+:)?Certification>(.*?)</(?:\w+:)?Certification>", xml_text, re.DOTALL)
    certifications = []
    for cert_xml in cert_blocks:
        def cert_field(tag: str) -> str:
            m = re.search(rf"<(?:\w+:)?{tag}>(.*?)</(?:\w+:)?{tag}>", cert_xml, re.DOTALL)
            return m.group(1).strip() if m else None
        certifications.append({
            "cert_id": cert_field("CertId"),
            "name": cert_field("Name"),
            "issued_date": cert_field("IssuedDate"),
            "issuer": cert_field("Issuer"),
        })

    return {
        "sk_id": get_text("SkId"),
        "candidate_name": get_text("CandidateName"),
        "date_of_birth": get_text("DateOfBirth"),
        "training_hours": int(get_text("TrainingHours") or 0),
        "assessment_score": float(get_text("AssessmentScore") or 0.0),
        "district": get_text("District"),
        "skills": skills,
        "certifications": certifications,
    }


class SoapAdapter(AdapterBase):
    """
    SIH: SoapAdapter → Skill Legacy SOAP/XML API.
    Demonstrates brownfield integration with heterogeneous legacy protocol.
    """
    system_name = "skill"

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {create_service_token()}",
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "GetSkills",
        }

    async def fetch(self, params: dict[str, Any]) -> CanonicalEnvelope:
        system_id = params["system_identifier"]
        canonical_id = params["canonical_id"]
        request_id = params["request_id"]
        url = f"{settings.skill_api_url}/soap"
        soap_body = _build_get_skills_envelope(system_id)

        log.info(f"[SoapAdapter] fetch request_id={request_id} sk_id={system_id}")

        try:
            async with httpx.AsyncClient(timeout=settings.timeout_per_system) as client:
                resp = await client.post(url, content=soap_body.encode(), headers=self._get_headers())
        except httpx.TimeoutException:
            raise AdapterError(self.system_name, f"SOAP timeout calling {url}", retryable=True)
        except httpx.RequestError as e:
            raise AdapterError(self.system_name, f"SOAP request error: {e}", retryable=True)

        if resp.status_code == 503:
            raise AdapterError(self.system_name, "Skill system unavailable (503)", status_code=503, retryable=True)
        if resp.status_code not in (200, 500):  # SOAP faults come as 500
            raise AdapterError(self.system_name, f"Unexpected HTTP {resp.status_code}", retryable=True)

        raw_dict = _parse_soap_to_dict(resp.text)  # raises AdapterError on SOAP fault
        canonical_data = map_to_canonical(self.system_name, raw_dict)

        log.info(f"[SoapAdapter] fetch success for {system_id}")
        return CanonicalEnvelope(
            canonical_id=canonical_id,
            system_name=self.system_name,
            system_identifier=system_id,
            raw_data=raw_dict,
            canonical_data=canonical_data,
            request_id=request_id,
        )

    async def submit(self, params: dict[str, Any]) -> OperationResult:
        request_id = params["request_id"]
        system_id = params.get("system_identifier", "")
        envelope = f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:skl="http://maharashtra.gov.in/skill/v1">
  <soapenv:Header/>
  <soapenv:Body>
    <skl:SubmitSkillCheckRequest>
      <skl:SkId>{system_id}</skl:SkId>
      <skl:AssessmentType>ELIGIBILITY</skl:AssessmentType>
    </skl:SubmitSkillCheckRequest>
  </soapenv:Body>
</soapenv:Envelope>"""
        headers = self._get_headers()
        headers["SOAPAction"] = "SubmitSkillCheck"
        try:
            async with httpx.AsyncClient(timeout=settings.timeout_per_system) as client:
                resp = await client.post(f"{settings.skill_api_url}/soap", content=envelope.encode(), headers=headers)
        except (httpx.TimeoutException, httpx.RequestError) as e:
            raise AdapterError(self.system_name, str(e), retryable=True)
        return OperationResult(
            request_id=request_id,
            system_name=self.system_name,
            status="success" if resp.status_code == 200 else "failure",
            message=f"SOAP HTTP {resp.status_code}",
        )

    async def status(self, request_id: str) -> StatusEnvelope:
        return StatusEnvelope(request_id=request_id, system_name=self.system_name, stage="unknown")
