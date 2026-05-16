"""
Omium SDK integration for Nexus agent pipeline observability.

Following the official LangGraph integration guide:
  https://docs.omium.ai/docs/build-with-omium/langgraph

Call ``init_omium()`` once at FastAPI lifespan startup.  It runs
``omium.init(auto_trace=True, …)`` which auto-detects LangGraph and
monkey-patches ``CompiledStateGraph.invoke / ainvoke / stream / astream``
so every ``pipeline.ainvoke()`` is traced automatically.

CLOUDFLARE FIX: The Omium API (api.omium.ai) sits behind Cloudflare.
The SDK's bare httpx requests (no User-Agent / Accept headers) trigger
a 403 challenge page.  We patch the OmiumTracer HTTP methods *minimally*
— injecting extra headers into the existing logic rather than replacing
the entire method body.
"""

import os
import logging
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

_omium_initialised = False

# ── Single, canonical project name used everywhere ──
_PROJECT_NAME = "nexus"

# Headers that satisfy Cloudflare bot protection on api.omium.ai
_CF_SAFE_HEADERS = {
    "User-Agent": "omium-sdk/python (Nexus/1.0)",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}


def _patch_tracer_headers():
    """
    Minimally patch OmiumTracer._send_spans and _asend_spans so that
    every outgoing httpx request includes Cloudflare-safe headers.

    Instead of replacing the full method, we wrap the original and
    monkey-patch ``httpx.Client`` / ``httpx.AsyncClient`` to inject
    the extra default headers for the duration of the call.
    """
    try:
        from omium.integrations.tracer import OmiumTracer
        import httpx

        _orig_send = OmiumTracer._send_spans
        _orig_asend = OmiumTracer._asend_spans

        def _wrapped_send(self, spans):
            # Temporarily override httpx.Client so any Client() opened
            # inside _send_spans gets the extra headers.
            _OrigClient = httpx.Client

            class _PatchedClient(_OrigClient):
                def __init__(self, **kw):
                    headers = dict(kw.pop("headers", {}) or {})
                    headers.update(_CF_SAFE_HEADERS)
                    super().__init__(headers=headers, **kw)

            httpx.Client = _PatchedClient
            try:
                return _orig_send(self, spans)
            finally:
                httpx.Client = _OrigClient

        async def _wrapped_asend(self, spans):
            _OrigAsyncClient = httpx.AsyncClient

            class _PatchedAsyncClient(_OrigAsyncClient):
                def __init__(self, **kw):
                    headers = dict(kw.pop("headers", {}) or {})
                    headers.update(_CF_SAFE_HEADERS)
                    super().__init__(headers=headers, **kw)

            httpx.AsyncClient = _PatchedAsyncClient
            try:
                return await _orig_asend(self, spans)
            finally:
                httpx.AsyncClient = _OrigAsyncClient

        OmiumTracer._send_spans = _wrapped_send
        OmiumTracer._asend_spans = _wrapped_asend
        logger.debug("Patched OmiumTracer with Cloudflare-safe headers")

    except Exception as exc:
        logger.warning("Could not patch Omium tracer headers: %s", exc)


def init_omium() -> bool:
    """
    Initialise the Omium SDK using env vars OMIUM_API_KEY / OMIUM_API_URL.

    Following the official docs, we call ``omium.init()`` once with
    ``auto_trace=True``.  The SDK automatically detects LangGraph and
    calls ``instrument_langgraph()`` under the hood, so there is no need
    to call it ourselves.

    Call this once during FastAPI lifespan startup.  Returns True if
    initialisation succeeded, False otherwise (so the app still boots
    even if tracing is unavailable).
    """
    global _omium_initialised

    if _omium_initialised:
        return True

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")

    api_key = os.getenv("OMIUM_API_KEY")
    api_url = os.getenv("OMIUM_API_URL")
    project = os.getenv("OMIUM_PROJECT", _PROJECT_NAME)

    if not api_key:
        logger.warning("OMIUM_API_KEY not set — Omium tracing disabled")
        return False

    try:
        import omium

        # Single init — auto_trace=True makes the SDK detect LangGraph
        # and call instrument_langgraph() automatically.
        omium.init(
            api_key=api_key,
            api_base_url=api_url or "https://api.omium.ai",
            project=project,
            auto_trace=True,
            auto_checkpoint=True,
            checkpoint_strategy="node",
        )

        # Patch httpx headers so Cloudflare doesn't block trace ingestion
        _patch_tracer_headers()

        _omium_initialised = True
        logger.info("Omium tracing initialised (project=%s)", project)
        return True

    except Exception as exc:
        logger.error("Failed to initialise Omium SDK: %s", exc)
        return False


def flush_omium_traces() -> None:
    """
    Flush all pending Omium spans to the backend immediately.

    Call this after every pipeline run completes.  The SDK's built-in
    aflush() fires inside the span context manager (before the span is
    added to the buffer), so spans accumulate in memory and would only
    be sent at process shutdown — which never happens in a long-running
    FastAPI server.  This explicit flush fixes that.
    """
    if not _omium_initialised:
        return

    try:
        from omium.integrations.tracer import flush_all_tracers
        flush_all_tracers()
    except Exception as e:
        logger.warning("Failed to flush Omium traces: %s", e)


def is_omium_active() -> bool:
    """Check whether Omium tracing was successfully initialised."""
    return _omium_initialised
