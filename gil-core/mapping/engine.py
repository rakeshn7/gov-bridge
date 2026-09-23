"""
GIL Core — mapping/engine.py
SIH26129 Component: Schema Mapping Engine

Config-driven mapping runner that transforms native system responses
into the GIL canonical schema using YAML mapping files.

Supports:
  - Field renames (source → target)
  - Type casts (string, int, float, bool, date)
  - Transforms:
      date_format   — reformat date strings (e.g. DD/MM/YYYY → ISO8601)
      hash_sha256   — hash a field value (for PII protection in audit)
      xml_to_str    — flatten an XML element value
      upper         — uppercase string
      lower         — lowercase string

Mapping config YAML structure:
  system: employment
  version: 1
  fields:
    - source: <source_field>
      target: <canonical_field>
      type: string | int | float | bool | date
      transform: <optional transform name>
      params: <optional dict of transform parameters>
"""

import hashlib
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

log = logging.getLogger(__name__)

CONFIGS_DIR = Path(__file__).parent / "configs"


def _load_config(system_name: str) -> dict:
    """Load YAML mapping config for a given system."""
    config_path = CONFIGS_DIR / f"{system_name}.yaml"
    if not config_path.exists():
        raise FileNotFoundError(f"Mapping config not found for system '{system_name}': {config_path}")
    with open(config_path) as f:
        return yaml.safe_load(f)


def _apply_transform(value: Any, transform: str, params: dict) -> Any:
    """Apply a named transform to a field value."""
    if transform == "date_format":
        if value is None:
            return None
        from_fmt = params.get("from", "%d/%m/%Y")
        to_fmt = params.get("to", "ISO8601")
        try:
            dt = datetime.strptime(str(value), from_fmt)
            return dt.date().isoformat() if to_fmt == "ISO8601" else dt.strftime(to_fmt)
        except ValueError as e:
            log.warning(f"date_format transform failed: {e}. Returning original: {value}")
            return value

    elif transform == "hash_sha256":
        if value is None:
            return None
        return hashlib.sha256(str(value).encode()).hexdigest()

    elif transform == "upper":
        return str(value).upper() if value else value

    elif transform == "lower":
        return str(value).lower() if value else value

    elif transform == "xml_to_str":
        # Strip XML tags — used when raw XML leaks into mapped fields
        import re
        return re.sub(r"<[^>]+>", "", str(value)).strip() if value else value

    else:
        log.warning(f"Unknown transform '{transform}' — returning value unchanged")
        return value


def _cast_type(value: Any, type_name: str) -> Any:
    """Cast a value to the configured canonical type."""
    if value is None:
        return None
    try:
        if type_name == "string":
            return str(value)
        elif type_name == "int":
            return int(value)
        elif type_name == "float":
            return float(value)
        elif type_name == "bool":
            return bool(value)
        elif type_name == "date":
            return str(value)  # dates handled by date_format transform
        else:
            return value
    except (ValueError, TypeError) as e:
        log.warning(f"Type cast to '{type_name}' failed for value '{value}': {e}")
        return value


def _get_nested(data: dict, path: str) -> Any:
    """Resolve dotted nested key path: 'address.city' → data['address']['city']"""
    parts = path.split(".")
    val = data
    for part in parts:
        if isinstance(val, dict):
            val = val.get(part)
        else:
            return None
    return val


def map_to_canonical(system_name: str, native_data: dict) -> dict:
    """
    Transform native system response to GIL canonical schema.

    Args:
        system_name: 'employment' | 'skill' | 'revenue'
        native_data: raw dict from system adapter

    Returns:
        canonical_data dict with renamed, typed, and transformed fields.
    """
    config = _load_config(system_name)
    canonical: dict[str, Any] = {}

    for field_def in config.get("fields", []):
        source_key = field_def["source"]
        target_key = field_def["target"]
        type_name = field_def.get("type", "string")
        transform = field_def.get("transform")
        params = field_def.get("params", {})

        # Support nested source paths
        value = _get_nested(native_data, source_key)

        # Apply type cast
        value = _cast_type(value, type_name)

        # Apply transform
        if transform:
            value = _apply_transform(value, transform, params)

        canonical[target_key] = value

    log.debug(f"Mapped {system_name}: {list(canonical.keys())}")
    return canonical
