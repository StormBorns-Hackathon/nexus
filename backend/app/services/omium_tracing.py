"""
Omium SDK integration for Nexus agent pipeline observability.

Initialises Omium at FastAPI startup so LangGraph auto-instrumentation
is active before any pipeline runs.

NOTE: The Omium SDK v0.4.1 has a known issue where aflush() inside the
@omium.trace decorator and _patched_ainvoke runs INSIDE the
`with tracer.span()` context manager, meaning the span has not yet been
added to `_spans` when flush occurs. Spans are only actually sent at
process shutdown via `flush_all_tracers()` — which never fires in a
long-running FastAPI server.

We work around this by calling `flush_all_tracers()` explicitly after
each pipeline run completes (see graphs/pipeline.py).
"""

import os
import logging

logger = logging.getLogger(__name__)

_omium_initialised = False


def init_omium() -> bool:
    """
    Initialise the Omium SDK using env vars OMIUM_API_KEY / OMIUM_API_URL.

    Call once during FastAPI lifespan startup.  Returns True if
    initialisation succeeded, False otherwise (so the app still boots
    even if tracing is unavailable).
    """
    global _omium_initialised

    api_key = os.getenv("OMIUM_API_KEY")
    api_url = os.getenv("OMIUM_API_URL")

    if not api_key:
        logger.warning("OMIUM_API_KEY not set — Omium tracing disabled")
        return False

    try:
        import omium

        omium.init(
            api_key=api_key,
            api_base_url=api_url or "https://api.omium.ai",
            project="nexus",
            auto_trace=True,
            auto_checkpoint=True,
        )

        _omium_initialised = True
        logger.info("Omium tracing initialised (project=nexus)")
        return True

    except Exception as exc:
        logger.error(f"Failed to initialise Omium SDK: {exc}")
        return False


def flush_omium_traces() -> None:
    """
    Flush all pending Omium spans to the backend immediately.

    Call this after every pipeline run completes. This is required
    because the SDK's built-in aflush() fires before spans are added
    to the internal buffer (SDK bug), so spans only accumulate in
    memory and would normally only be sent at process shutdown.
    """
    if not _omium_initialised:
        return

    try:
        from omium.integrations.tracer import flush_all_tracers
        flush_all_tracers()
    except Exception as e:
        logger.warning(f"Failed to flush Omium traces: {e}")


def is_omium_active() -> bool:
    """Check whether Omium tracing was successfully initialised."""
    return _omium_initialised
