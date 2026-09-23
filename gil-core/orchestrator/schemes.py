"""
GIL Core — orchestrator/schemes.py
SIH26129 Component: Configurable Scheme Workflows Manager
"""

import os
from typing import Any
import yaml

_WORKFLOWS_PATH = os.path.join(os.path.dirname(__file__), "workflows.yaml")


def load_scheme_definitions() -> dict[str, Any]:
    """Loads all pre-configured government scheme workflow pipelines."""
    if not os.path.exists(_WORKFLOWS_PATH):
        return {}
    with open(_WORKFLOWS_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data.get("schemes", {})


def get_scheme(scheme_id: str) -> dict[str, Any] | None:
    """Returns scheme configuration by id."""
    schemes = load_scheme_definitions()
    return schemes.get(scheme_id)
