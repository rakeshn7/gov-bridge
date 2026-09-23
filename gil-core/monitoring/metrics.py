"""
GIL Core — monitoring/metrics.py
SIH26129 Component: Monitoring & Metrics (Prometheus-format)

Exposes named counters and histograms for:
  - Total requests processed (by status)
  - Adapter failures (by system)
  - Request latency (by system)
  - Retry attempts (by system)
  - Manual review queue depth
  - Consent denials
  - RBAC field redactions (by role)

Metrics endpoint: GET /metrics (text/plain Prometheus format)
"""

from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response

# ─── Counters ─────────────────────────────────────────────────────────────────

gil_requests_total = Counter(
    "gil_requests_total",
    "Total GIL orchestration requests processed",
    ["status"],  # success | failure | manual_review
)

gil_adapter_failures_total = Counter(
    "gil_adapter_failures_total",
    "Total adapter failures by system",
    ["system"],  # employment | skill | revenue
)

gil_retry_attempts_total = Counter(
    "gil_retry_attempts_total",
    "Total retry attempts by system",
    ["system"],
)

gil_consent_denied_total = Counter(
    "gil_consent_denied_total",
    "Total consent denials",
    [],
)

gil_rbac_redactions_total = Counter(
    "gil_rbac_redactions_total",
    "Total RBAC field redactions by requesting role",
    ["role"],
)

# ─── Histograms ───────────────────────────────────────────────────────────────

gil_request_latency_seconds = Histogram(
    "gil_request_latency_seconds",
    "End-to-end GIL request latency in seconds",
    ["system"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
)

# ─── Gauges ───────────────────────────────────────────────────────────────────

gil_manual_review_queue_depth = Gauge(
    "gil_manual_review_queue_depth",
    "Current number of unresolved manual review items",
)


# ─── Metrics endpoint handler ─────────────────────────────────────────────────

def metrics_response() -> Response:
    """Return Prometheus text format metrics for GET /metrics."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
