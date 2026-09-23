"""
GIL Core — adapters/rest_adapter.py
SIH26129 Component: REST Adapter → Employment System (FastAPI :8001)

Implements AdapterBase for a modern REST/JSON departmental system.
Uses httpx async client with service JWT auth.
Applies schema mapping engine to produce CanonicalEnvelope.
"""

import logging
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


class RestAdapter(AdapterBase):
    """
    SIH: RestAdapter → Employment REST API.
    Demonstrates brownfield integration with a modern JSON API.
    """
    system_name = "employment"

    def _get_headers(self) -> dict:
        """Attach service-to-service JWT (GILService role) to all requests."""
        return {
            "Authorization": f"Bearer {create_service_token()}",
            "Content-Type": "application/json",
        }

    async def fetch(self, params: dict[str, Any]) -> CanonicalEnvelope:
        """
        Fetch employee record from Employment REST API.
        params: { system_identifier, canonical_id, request_id }
        """
        system_id = params["system_identifier"]
        canonical_id = params["canonical_id"]
        request_id = params["request_id"]
        url = f"{settings.employment_api_url}/employee/{system_id}"

        log.info(f"[RestAdapter] fetch request_id={request_id} emp_id={system_id}")

        try:
            async with httpx.AsyncClient(timeout=settings.timeout_per_system) as client:
                resp = await client.get(url, headers=self._get_headers())
        except httpx.TimeoutException:
            raise AdapterError(self.system_name, f"Timeout calling {url}", retryable=True)
        except httpx.RequestError as e:
            raise AdapterError(self.system_name, f"Request error: {e}", retryable=True)

        if resp.status_code == 503:
            raise AdapterError(self.system_name, "Employment system unavailable (503)", status_code=503, retryable=True)
        if resp.status_code == 404:
            raise AdapterError(self.system_name, f"Employee {system_id} not found (404)", status_code=404, retryable=False)
        if resp.status_code != 200:
            raise AdapterError(self.system_name, f"Unexpected status {resp.status_code}", status_code=resp.status_code, retryable=True)

        raw_data = resp.json()
        canonical_data = map_to_canonical(self.system_name, raw_data)

        log.info(f"[RestAdapter] fetch success for {system_id}")
        return CanonicalEnvelope(
            canonical_id=canonical_id,
            system_name=self.system_name,
            system_identifier=system_id,
            raw_data=raw_data,
            canonical_data=canonical_data,
            request_id=request_id,
        )

    async def submit(self, params: dict[str, Any]) -> OperationResult:
        """Submit data update to Employment system."""
        system_id = params["system_identifier"]
        request_id = params["request_id"]
        payload = params.get("payload", {})
        url = f"{settings.employment_api_url}/employee/search"

        try:
            async with httpx.AsyncClient(timeout=settings.timeout_per_system) as client:
                resp = await client.post(url, json=payload, headers=self._get_headers())
        except (httpx.TimeoutException, httpx.RequestError) as e:
            raise AdapterError(self.system_name, str(e), retryable=True)

        return OperationResult(
            request_id=request_id,
            system_name=self.system_name,
            status="success" if resp.status_code < 300 else "failure",
            message=f"HTTP {resp.status_code}",
            data=resp.json() if resp.status_code < 300 else None,
        )

    async def status(self, request_id: str) -> StatusEnvelope:
        return StatusEnvelope(request_id=request_id, system_name=self.system_name, stage="unknown")
