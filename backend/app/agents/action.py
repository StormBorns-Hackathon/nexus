from app.tools.slack import send_slack_message
from app.tools.email_tool import send_email
from app.services.trace import emit_trace
import json
import logging
import re
from dotenv import load_dotenv
import os
from ..services.llm import client

load_dotenv()
logger = logging.getLogger(__name__)

MODEL_NAME = "openai/gpt-oss-120b:free"
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
SLACK_CHANNEL_ID = os.getenv("SLACK_CHANNEL_ID")

ACTION_SYSTEM_PROMPT = """You are an action agent. Given research findings and
an action plan, compose a professional message to deliver via Slack.
Use plain text only. Do not use Markdown, bullets, headings with #, code
fences, tables, bold, italics, or link formatting. Keep the message concise
and include a useful summary even if research is sparse.
Respond in JSON: {"message": "...", "subject": "..."}"""


def _plain_text(value: object) -> str:
    text = str(value or "")
    text = re.sub(r"```.*?```", "", text, flags=re.DOTALL)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"[*_~>|]", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _fallback_message(state: dict) -> str:
    signal = state.get("signal_payload", {})
    summary = _plain_text(state.get("research_summary"))
    if not summary:
        summary = _plain_text(signal.get("body")) or "No PR or issue description was provided."

    return _plain_text(
        "\n".join(
            [
                "Nexus Pipeline Report",
                "",
                f"Signal: {signal.get('title', 'Unknown')}",
                f"Repo: {signal.get('repo', 'N/A')}",
                f"URL: {signal.get('url', 'N/A')}",
                "",
                "Summary:",
                summary[:1500],
                "",
                f"Recommended action: {state.get('action_plan', 'Review the signal and follow up with the owner.')}",
            ]
        )
    )


async def action_node(state: dict, ws_manager=None) -> dict:
    workflow_id = state["workflow_id"]
    traces = []

    traces.append(
        await emit_trace(
            ws_manager,
            workflow_id,
            "action",
            "thinking",
            {"message": "Composing deliverable from research..."},
        )
    )

    # Try LLM to compose message; fall back to a basic summary if it fails
    message_text = None
    try:
        response = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": ACTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "action_plan": state["action_plan"],
                            "research_summary": state["research_summary"],
                            "signal": state["signal_payload"],
                        }
                    ),
                },
            ],
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        if content:
            result = json.loads(content)
            message_text = _plain_text(result.get("message", ""))
    except Exception as e:
        logger.error(f"Action LLM failed: {e}")

    # If LLM failed or returned empty, build a fallback message
    if not message_text:
        message_text = _fallback_message(state)

    # Execute Slack action
    traces.append(
        await emit_trace(
            ws_manager,
            workflow_id,
            "action",
            "tool_call",
            {"tool": "send_slack_message", "channel": SLACK_CHANNEL_ID},
        )
    )

    action_result = "No action configured"
    confirmed = False

    if not SLACK_CHANNEL_ID:
        action_result = "Slack not configured (no channel ID)"
        logger.warning("SLACK_CHANNEL_ID is not set")
    elif not SLACK_BOT_TOKEN:
        action_result = f"[DRY RUN] Would send: {message_text[:200]}"
        confirmed = True
    else:
        try:
            slack_resp = await send_slack_message(SLACK_CHANNEL_ID, message_text)
            confirmed = slack_resp.get("ok", False)
            action_result = f"Slack: {'sent' if confirmed else 'failed'}"
            if not confirmed:
                logger.error(f"Slack API error: {slack_resp}")
        except Exception as e:
            action_result = f"Slack failed: {str(e)}"
            logger.error(f"Slack send exception: {e}")

    traces.append(
        await emit_trace(
            ws_manager,
            workflow_id,
            "action",
            "result",
            {
                "action_result": action_result,
                "confirmed": confirmed,
                "message_preview": message_text[:500],
            },
        )
    )

    return {
        "action_type": "slack",
        "action_result": action_result,
        "action_confirmed": confirmed,
        "slack_message": message_text,
        "trace_events": traces,
    }
