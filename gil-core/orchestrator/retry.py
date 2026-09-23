"""
GIL Core — orchestrator/retry.py
SIH26129 Component: Failure Handling (Exponential Backoff + Redis Queue)

Two-Tier Queue Design:
  Tier 1 — Redis (transient): holds in-flight retry jobs with exponential backoff.
            Entries are cleared from Redis once a retry succeeds or max_attempts exhausted.
  Tier 2 — PostgreSQL manual_review_queue (permanent): created ONLY when retries
            are exhausted (retry_count >= max_attempts). This is the source of truth
            for the dashboard's manual review UI.

Config (from env via settings):
  initial_delay=2s, backoff_factor=2, max_attempts=3
"""

import asyncio
import json
import logging
from typing import Any, Callable, Awaitable

import redis.asyncio as aioredis

from config import get_settings
from monitoring.metrics import gil_retry_attempts_total, gil_adapter_failures_total

log = logging.getLogger(__name__)
settings = get_settings()

REDIS_RETRY_QUEUE = "gil:retry_queue"
REDIS_MANUAL_REVIEW_QUEUE = "gil:manual_review_in_flight"


async def get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def with_retry(
    fn: Callable[[], Awaitable[Any]],
    system_name: str,
    request_id: str,
    initial_delay: float | None = None,
    backoff_factor: float | None = None,
    max_attempts: int | None = None,
) -> Any:
    """
    Execute fn() with exponential backoff retry.
    On each failure, pushes status to Redis retry queue.
    On exhaustion, raises RetryExhaustedError with full trace.

    Args:
        fn: async callable to retry (must raise AdapterError on failure)
        system_name: 'employment' | 'skill' | 'revenue' (for metrics)
        request_id: orchestration request ID
        initial_delay: override settings.retry_initial_delay
        backoff_factor: override settings.retry_backoff_factor
        max_attempts: override settings.retry_max_attempts

    Returns: result of fn() on success
    Raises: RetryExhaustedError if all attempts fail
    """
    delay = initial_delay or settings.retry_initial_delay
    factor = backoff_factor or settings.retry_backoff_factor
    attempts = max_attempts or settings.retry_max_attempts

    last_error = None
    redis = await get_redis()

    for attempt in range(1, attempts + 1):
        try:
            result = await fn()
            log.info(f"[Retry] {system_name} succeeded on attempt {attempt}/{attempts}")
            # Clear Redis in-flight entry on success
            await redis.lrem(REDIS_RETRY_QUEUE, 0, json.dumps({"request_id": request_id, "system": system_name}))
            return result

        except Exception as e:
            last_error = e
            gil_adapter_failures_total.labels(system=system_name).inc()
            log.warning(f"[Retry] {system_name} attempt {attempt}/{attempts} failed: {e}")

            if attempt < attempts:
                # Push retry status to Redis (transient in-flight tracking)
                retry_record = {
                    "request_id": request_id,
                    "system": system_name,
                    "attempt": attempt,
                    "delay": delay,
                    "error": str(e),
                }
                await redis.lpush(REDIS_RETRY_QUEUE, json.dumps(retry_record))
                gil_retry_attempts_total.labels(system=system_name).inc()
                log.info(f"[Retry] {system_name} sleeping {delay}s before attempt {attempt+1}")
                await asyncio.sleep(delay)
                delay *= factor
            else:
                log.error(f"[Retry] {system_name} exhausted all {attempts} attempts")

    raise RetryExhaustedError(
        system=system_name,
        request_id=request_id,
        attempts=attempts,
        last_error=str(last_error),
    )


class RetryExhaustedError(Exception):
    """Raised when all retry attempts are exhausted. Triggers manual_review_queue write."""
    def __init__(self, system: str, request_id: str, attempts: int, last_error: str):
        self.system = system
        self.request_id = request_id
        self.attempts = attempts
        self.last_error = last_error
        super().__init__(f"[{system}] Exhausted {attempts} retries for request {request_id}: {last_error}")


async def push_to_manual_review(
    db,  # AsyncSession
    request_id: str,
    system_name: str,
    retry_count: int,
    error_trace: str,
    request_payload: dict,
) -> str:
    """
    Write permanent manual_review_queue record to PostgreSQL.
    Called by orchestrator after RetryExhaustedError.
    This is Tier 2 of the dual-tier queue design.
    Also removes in-flight entry from Redis Tier 1.
    """
    from sqlalchemy import text
    result = await db.execute(
        text("""
            INSERT INTO manual_review_queue
              (request_id, system_name, error_trace, retry_count, request_payload, status)
            VALUES (:rid, :sys, :err, :rc, :payload, 'pending')
            RETURNING id
        """),
        {
            "rid": request_id,
            "sys": system_name,
            "err": error_trace,
            "rc": retry_count,
            "payload": json.dumps(request_payload),
        },
    )
    await db.commit()
    review_id = str(result.scalar())

    # Clear Redis in-flight entry (Tier 1 cleanup)
    try:
        redis = await get_redis()
        await redis.lrem(REDIS_RETRY_QUEUE, 0, json.dumps({"request_id": request_id, "system": system_name}))
    except Exception:
        pass

    log.warning(f"[Retry] Created manual_review record id={review_id} for {system_name}/{request_id}")
    return review_id
