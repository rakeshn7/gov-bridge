"""
GIL Core — tests/unit/test_retry.py
SIH26129: Unit tests for retry logic and RetryExhaustedError
"""
import asyncio
import pytest
from unittest.mock import AsyncMock, patch
from orchestrator.retry import with_retry, RetryExhaustedError


@pytest.mark.asyncio
async def test_retry_succeeds_on_second_attempt():
    """Function that fails once then succeeds — retry should catch it."""
    call_count = 0

    async def flaky():
        nonlocal call_count
        call_count += 1
        if call_count < 2:
            raise Exception("transient failure")
        return "ok"

    with patch("orchestrator.retry.asyncio.sleep", new_callable=AsyncMock):
        with patch("orchestrator.retry.get_redis", return_value=AsyncMock(lpush=AsyncMock(), lrem=AsyncMock())):
            result = await with_retry(flaky, "employment", "req-1", initial_delay=0.01, max_attempts=3)

    assert result == "ok"
    assert call_count == 2


@pytest.mark.asyncio
async def test_retry_exhausted_raises():
    """Function that always fails — should raise RetryExhaustedError after max_attempts."""
    async def always_fail():
        raise Exception("permanent failure")

    with patch("orchestrator.retry.asyncio.sleep", new_callable=AsyncMock):
        with patch("orchestrator.retry.get_redis", return_value=AsyncMock(lpush=AsyncMock(), lrem=AsyncMock())):
            with pytest.raises(RetryExhaustedError) as exc_info:
                await with_retry(always_fail, "skill", "req-2", initial_delay=0.01, max_attempts=3)

    assert exc_info.value.system == "skill"
    assert exc_info.value.attempts == 3
    assert "permanent failure" in exc_info.value.last_error


@pytest.mark.asyncio
async def test_retry_exhausted_error_attributes():
    err = RetryExhaustedError(system="revenue", request_id="req-3", attempts=3, last_error="DB timeout")
    assert err.system == "revenue"
    assert err.request_id == "req-3"
    assert "revenue" in str(err)
    assert "DB timeout" in str(err)
