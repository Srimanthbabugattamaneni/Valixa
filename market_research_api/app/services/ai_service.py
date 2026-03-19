"""
AI Service — thin async wrapper around the Anthropic Claude Messages API.

Responsibilities:
  - Manage a single shared httpx.AsyncClient (connection-pooled).
  - Send individual section prompts concurrently via asyncio.gather.
  - Handle retries, timeouts, and API error mapping to domain exceptions.
"""
import asyncio
import logging
from typing import Any, Dict, List

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class AIServiceError(Exception):
    """Raised when the AI provider returns an unrecoverable error."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.status_code = status_code


class AIRateLimitError(AIServiceError):
    """Raised on HTTP 429 responses."""

    def __init__(self) -> None:
        super().__init__("AI provider rate limit exceeded. Please retry shortly.", status_code=429)


class AITimeoutError(AIServiceError):
    """Raised when a request to the AI provider times out."""

    def __init__(self) -> None:
        super().__init__("AI provider timed out. Please retry.", status_code=504)


# ---------------------------------------------------------------------------
# Client lifecycle helpers
# ---------------------------------------------------------------------------

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url="https://api.anthropic.com",
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            timeout=httpx.Timeout(
                connect=10.0,
                read=settings.AI_TIMEOUT_SECONDS,
                write=10.0,
                pool=5.0,
            ),
        )
    return _client


async def close_client() -> None:
    """Gracefully close the shared HTTP client on app shutdown."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None
        logger.info("AI service HTTP client closed.")


# ---------------------------------------------------------------------------
# Core call helper
# ---------------------------------------------------------------------------

_MAX_RETRIES = 1
_RETRY_BACKOFF_BASE = 1.5     # seconds — for network/5xx errors
_RATE_LIMIT_BACKOFF = 60.0    # seconds — Anthropic rate limit window


async def _call_claude(
    system_prompt: str,
    user_prompt: str,
    label: str = "section",
    retries: int = _MAX_RETRIES,
) -> str:
    """
    Fire a single Claude Messages request and return the text.

    Retries on transient errors (5xx, network issues) with exponential back-off.
    Raises AIServiceError subclasses for all non-retryable failures.
    """
    payload: Dict[str, Any] = {
        "model": settings.AI_MODEL,
        "max_tokens": settings.AI_MAX_TOKENS,
        "temperature": settings.AI_TEMPERATURE,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_prompt}
        ],
    }

    attempt = 0
    while True:
        attempt += 1
        try:
            logger.debug(f"[AI] Requesting '{label}' (attempt {attempt})")
            response = await _get_client().post("/v1/messages", json=payload)
        except httpx.TimeoutException as exc:
            logger.warning(f"[AI] Timeout on '{label}' attempt {attempt}: {exc}")
            if attempt > retries:
                raise AITimeoutError() from exc
            await asyncio.sleep(_RETRY_BACKOFF_BASE**attempt)
            continue
        except httpx.RequestError as exc:
            logger.warning(f"[AI] Network error on '{label}' attempt {attempt}: {exc}")
            if attempt > retries:
                raise AIServiceError(f"Network error communicating with AI provider: {exc}") from exc
            await asyncio.sleep(_RETRY_BACKOFF_BASE**attempt)
            continue

        if response.status_code == 429:
            retry_after = float(response.headers.get("retry-after", _RATE_LIMIT_BACKOFF))
            logger.warning(f"[AI] Rate limited on '{label}', backing off {retry_after}s")
            if attempt > retries:
                raise AIRateLimitError()
            await asyncio.sleep(retry_after)
            continue

        if response.status_code in (500, 502, 503):
            logger.warning(f"[AI] Server error {response.status_code} on '{label}' attempt {attempt}")
            if attempt > retries:
                raise AIServiceError(
                    f"AI provider returned {response.status_code}. Please retry later.",
                    status_code=502,
                )
            await asyncio.sleep(_RETRY_BACKOFF_BASE**attempt)
            continue

        if response.status_code != 200:
            body = response.text[:400]
            logger.error(f"[AI] Unexpected status {response.status_code} on '{label}': {body}")
            raise AIServiceError(
                f"AI provider returned unexpected status {response.status_code}.",
                status_code=502,
            )

        data = response.json()
        try:
            text: str = data["content"][0]["text"]
        except (KeyError, IndexError) as exc:
            logger.error(f"[AI] Unexpected response shape on '{label}': {data}")
            raise AIServiceError("Unexpected response format from AI provider.") from exc

        logger.debug(f"[AI] '{label}' completed ({len(text)} chars)")
        return text


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

async def generate_sections_concurrently(
    system_prompt: str,
    section_prompts: Dict[str, str],
) -> Dict[str, str]:
    """
    Fire all section prompts concurrently (up to AI_MAX_CONCURRENCY at a time)
    and return a mapping of {section_name: generated_text}.
    """
    semaphore = asyncio.Semaphore(settings.AI_MAX_CONCURRENCY)
    section_names: List[str] = list(section_prompts.keys())

    async def _bounded_call(name: str, prompt: str) -> tuple[str, str]:
        async with semaphore:
            text = await _call_claude(system_prompt, prompt, label=name)
            return name, text

    tasks = [
        _bounded_call(name, prompt)
        for name, prompt in section_prompts.items()
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    output: Dict[str, str] = {}
    for name, result in zip(section_names, results):
        if isinstance(result, Exception):
            logger.error(f"[AI] Section '{name}' failed: {result}")
            raise result
        _, text = result
        output[name] = text

    return output


async def generate_json_report(system_prompt: str, user_prompt: str, label: str = "report") -> dict:
    """
    Fire a single Claude call expecting a JSON response.
    Strips markdown code fences, then parses and returns the dict.
    """
    import json, re

    raw = await _call_claude(system_prompt, user_prompt, label=label)

    # Strip ```json ... ``` or ``` ... ``` wrappers Claude sometimes adds
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.MULTILINE)
    raw = re.sub(r"\s*```$", "", raw.strip(), flags=re.MULTILINE)

    try:
        return json.loads(raw.strip())
    except json.JSONDecodeError as exc:
        logger.error(f"[AI] JSON parse error: {exc}\nRaw (first 500): {raw[:500]}")
        raise AIServiceError("AI returned invalid JSON. Please retry.") from exc
