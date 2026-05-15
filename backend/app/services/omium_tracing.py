"""
Omium SDK integration for Nexus agent pipeline observability.

Initialises Omium at FastAPI startup so LangGraph auto-instrumentation
is active before any pipeline runs.  Every `pipeline.ainvoke()` call
will automatically produce a trace with per-node spans, checkpoints,
and a flush to the Omium dashboard.
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


def is_omium_active() -> bool:
    """Check whether Omium tracing was successfully initialised."""
    return _omium_initialised
