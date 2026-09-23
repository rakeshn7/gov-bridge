"""
GIL Core — adapters/base.py
SIH26129 Component: Connector / Adapter Layer

AdapterBase defines the common async interface all adapters must implement.
This enforces the "don't modify internal logic of mock systems" constraint —
interaction happens exclusively via this interface.

SIH Pipeline position: after Identity Mapping, before Workflow Orchestration.
"""

from abc import ABC, abstractmethod
from typing import Any

from models.schemas import CanonicalEnvelope, OperationResult, StatusEnvelope


class AdapterBase(ABC):
    """
    Abstract base class for all departmental system connectors.

    Implementing adapters:
      RestAdapter  → Employment REST API (FastAPI :8001)
      SoapAdapter  → Skill SOAP/XML API (FastAPI :8002)
      DbAdapter    → Revenue PostgreSQL (direct DB, no HTTP)

    All adapters must:
      1. Accept canonical params (including system_identifier from id_map lookup)
      2. Call the target system using its native protocol
      3. Apply schema mapping to produce canonical_data
      4. Return CanonicalEnvelope / OperationResult / StatusEnvelope
    """

    system_name: str = "unknown"

    @abstractmethod
    async def fetch(self, params: dict[str, Any]) -> CanonicalEnvelope:
        """
        Fetch data from target system.

        params must include:
          - system_identifier: str   native ID in target system (from id_map)
          - canonical_id: str        canonical citizen identifier
          - request_id: str          orchestration request ID

        Returns CanonicalEnvelope with raw_data + canonical_data.
        Raises AdapterError on system failure (triggers retry logic).
        """
        ...

    @abstractmethod
    async def submit(self, params: dict[str, Any]) -> OperationResult:
        """
        Submit data to target system.

        params must include:
          - system_identifier: str
          - canonical_id: str
          - request_id: str
          - payload: dict            data to submit

        Returns OperationResult.
        """
        ...

    @abstractmethod
    async def status(self, request_id: str) -> StatusEnvelope:
        """
        Query current status of a prior operation in target system.
        Used for async operations and manual retry flows.
        """
        ...


class AdapterError(Exception):
    """Raised when a target system call fails. Triggers retry logic in orchestrator."""
    def __init__(self, system: str, message: str, status_code: int = 0, retryable: bool = True):
        self.system = system
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        super().__init__(f"[{system}] {message}")
