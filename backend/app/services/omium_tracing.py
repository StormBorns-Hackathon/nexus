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

CLOUDFLARE FIX: The Omium API (api.omium.ai) is behind Cloudflare bot
protection. The SDK's default httpx requests lack proper headers (no
User-Agent, no Accept), causing Cloudflare to issue a 403 challenge page.
We monkey-patch the SDK tracer's _send_spans and _asend_spans methods to
include browser-compatible headers that pass Cloudflare's checks.
"""

import os
import logging
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

_omium_initialised = False
_PROJECT_NAME = "nexus-1"

# Headers that satisfy Cloudflare bot protection on api.omium.ai
_CF_SAFE_HEADERS = {
    "User-Agent": "omium-sdk/python (Nexus/1.0)",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}


def _patch_tracer_send_methods():
    """
    Monkey-patch OmiumTracer._send_spans and _asend_spans to include
    proper HTTP headers so Cloudflare doesn't block the requests.
    """
    try:
        from omium.integrations.tracer import OmiumTracer

        _original_send = OmiumTracer._send_spans
        _original_asend = OmiumTracer._asend_spans

        def _patched_send_spans(self, spans):
            """Patched _send_spans with Cloudflare-safe headers."""
            try:
                import httpx
                from datetime import datetime, timezone

                workflow_id = None
                if spans:
                    root_span = spans[0]
                    workflow_id = root_span.attributes.get("workflow_id")
                if not workflow_id:
                    workflow_id = self.project

                span_data_list = []
                for span in spans:
                    status = "ok"
                    status_message = None
                    if span.error:
                        status = "error"
                        status_message = span.error
                    elif not span.end_time:
                        status = "unset"

                    events = [
                        {"name": evt.name, "attributes": evt.attributes}
                        for evt in span.events
                    ]

                    start_time_dt = datetime.fromtimestamp(span.start_time, tz=timezone.utc)
                    end_time_dt = (
                        datetime.fromtimestamp(span.end_time, tz=timezone.utc)
                        if span.end_time
                        else None
                    )

                    span_data = {
                        "span_id": span.span_id,
                        "trace_id": span.trace_id,
                        "parent_span_id": span.parent_span_id,
                        "name": span.name,
                        "service_name": "omium-sdk",
                        "start_time": start_time_dt.isoformat(),
                        "end_time": end_time_dt.isoformat() if end_time_dt else None,
                        "duration_ms": int(span.latency_ms) if span.latency_ms else None,
                        "status": status,
                        "status_message": status_message,
                        "attributes": {
                            **(span.attributes or {}),
                            "span_type": span.span_type,
                            "workflow_id": workflow_id,
                        },
                        "events": events,
                    }

                    if span.input:
                        span_data["attributes"]["input"] = span.input
                    if span.output:
                        span_data["attributes"]["output"] = span.output
                    if span.error:
                        span_data["attributes"]["error"] = span.error
                        span_data["attributes"]["error_type"] = span.error_type
                    if span.token_count_input is not None:
                        span_data["attributes"]["token_count_input"] = span.token_count_input
                    if span.token_count_output is not None:
                        span_data["attributes"]["token_count_output"] = span.token_count_output
                    if span.token_count_total is not None:
                        span_data["attributes"]["token_count_total"] = span.token_count_total
                    if span.cost_usd is not None:
                        span_data["attributes"]["cost_usd"] = span.cost_usd

                    span_data_list.append(span_data)

                payload = {
                    "project": self.project,
                    "execution_id": self.execution_id,
                    "spans": span_data_list,
                    "sdk_version": __import__("omium", fromlist=["__version__"]).__version__,
                    "metadata": {
                        "workflow_id": workflow_id,
                        "trace_id": self.trace_id,
                    },
                }

                headers = {
                    "X-API-Key": self.config.api_key,
                    **_CF_SAFE_HEADERS,
                }

                with httpx.Client(timeout=self.config.timeout) as client:
                    response = client.post(
                        f"{self.config.api_base_url}/traces/ingest",
                        json=payload,
                        headers=headers,
                    )

                    if response.status_code >= 400:
                        logger.warning(
                            "Failed to send spans: %s (body truncated to 200 chars): %s",
                            response.status_code,
                            response.text[:200],
                        )
                    else:
                        logger.debug("Sent %d spans to Omium", len(spans))

            except ImportError:
                logger.warning("httpx not installed. Install with: pip install httpx")
            except Exception as e:
                logger.error("Failed to send spans: %s", e)
                import threading
                with self._lock:
                    self._spans.extend(spans)

        async def _patched_asend_spans(self, spans):
            """Patched _asend_spans with Cloudflare-safe headers."""
            try:
                import httpx
                from datetime import datetime, timezone

                workflow_id = None
                if spans:
                    root_span = spans[0]
                    workflow_id = root_span.attributes.get("workflow_id")
                if not workflow_id:
                    workflow_id = self.project

                span_data_list = []
                for span in spans:
                    status = "ok"
                    status_message = None
                    if span.error:
                        status = "error"
                        status_message = span.error
                    elif not span.end_time:
                        status = "unset"

                    events = [
                        {"name": evt.name, "attributes": evt.attributes}
                        for evt in span.events
                    ]

                    start_time_dt = datetime.fromtimestamp(span.start_time, tz=timezone.utc)
                    end_time_dt = (
                        datetime.fromtimestamp(span.end_time, tz=timezone.utc)
                        if span.end_time
                        else None
                    )

                    span_data = {
                        "span_id": span.span_id,
                        "trace_id": span.trace_id,
                        "parent_span_id": span.parent_span_id,
                        "name": span.name,
                        "service_name": "omium-sdk",
                        "start_time": start_time_dt.isoformat(),
                        "end_time": end_time_dt.isoformat() if end_time_dt else None,
                        "duration_ms": int(span.latency_ms) if span.latency_ms else None,
                        "status": status,
                        "status_message": status_message,
                        "attributes": {
                            **(span.attributes or {}),
                            "span_type": span.span_type,
                            "workflow_id": workflow_id,
                        },
                        "events": events,
                    }

                    if span.input:
                        span_data["attributes"]["input"] = span.input
                    if span.output:
                        span_data["attributes"]["output"] = span.output
                    if span.error:
                        span_data["attributes"]["error"] = span.error
                        span_data["attributes"]["error_type"] = span.error_type
                    if span.token_count_input is not None:
                        span_data["attributes"]["token_count_input"] = span.token_count_input
                    if span.token_count_output is not None:
                        span_data["attributes"]["token_count_output"] = span.token_count_output
                    if span.token_count_total is not None:
                        span_data["attributes"]["token_count_total"] = span.token_count_total
                    if span.cost_usd is not None:
                        span_data["attributes"]["cost_usd"] = span.cost_usd

                    span_data_list.append(span_data)

                payload = {
                    "project": self.project,
                    "execution_id": self.execution_id,
                    "spans": span_data_list,
                    "sdk_version": __import__("omium", fromlist=["__version__"]).__version__,
                    "metadata": {
                        "workflow_id": workflow_id,
                        "trace_id": self.trace_id,
                    },
                }

                headers = {
                    "X-API-Key": self.config.api_key,
                    **_CF_SAFE_HEADERS,
                }

                async with httpx.AsyncClient(timeout=self.config.timeout) as client:
                    response = await client.post(
                        f"{self.config.api_base_url}/traces/ingest",
                        json=payload,
                        headers=headers,
                    )

                    if response.status_code >= 400:
                        logger.warning(
                            "Failed to send spans: %s (body truncated to 200 chars): %s",
                            response.status_code,
                            response.text[:200],
                        )
                    else:
                        logger.debug("Sent %d spans to Omium", len(spans))

            except ImportError:
                logger.warning("httpx not installed. Install with: pip install httpx")
            except Exception as e:
                logger.error("Failed to send spans: %s", e)

        # Apply patches
        OmiumTracer._send_spans = _patched_send_spans
        OmiumTracer._asend_spans = _patched_asend_spans
        logger.debug("Patched OmiumTracer with Cloudflare-safe headers")

    except Exception as exc:
        logger.warning("Could not patch Omium tracer headers: %s", exc)


def init_omium() -> bool:
    """
    Initialise the Omium SDK using env vars OMIUM_API_KEY / OMIUM_API_URL.

    Call once during FastAPI lifespan startup.  Returns True if
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

        omium.init(
            api_key=api_key,
            api_base_url=api_url or "https://api.omium.ai",
            project=project,
            auto_trace=True,
            auto_checkpoint=True,
            checkpoint_strategy="node",
        )

        # Patch the tracer to include Cloudflare-safe headers AFTER init
        _patch_tracer_send_methods()

        _omium_initialised = True
        logger.info("Omium tracing initialised (project=%s)", project)
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
