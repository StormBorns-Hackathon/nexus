from app.tools.slack import send_slack_message, SLACK_BOT_TOKEN, SLACK_CHANNEL_ID
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
    user_slack = state.get("user_slack_config", {})

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

    # Determine which bot token and channels to use
    bot_token = user_slack.get("bot_token") or SLACK_BOT_TOKEN
    target_channels = user_slack.get("channels", [])

    # If no mapped channels, fall back to .env channel
    if not target_channels and SLACK_CHANNEL_ID:
        target_channels = [{"id": SLACK_CHANNEL_ID, "name": "default"}]

    if not bot_token:
        traces.append(
            await emit_trace(
                ws_manager, workflow_id, "action", "result",
                {"action_result": "Slack not configured", "confirmed": False},
            )
        )
        return {
            "action_type": "slack",
            "action_result": "Slack not configured — connect Slack in Integrations",
            "action_confirmed": False,
            "trace_events": traces,
        }

    if not target_channels:
        traces.append(
            await emit_trace(
                ws_manager, workflow_id, "action", "result",
                {"action_result": "No channels mapped", "confirmed": False},
            )
        )
        return {
            "action_type": "slack",
            "action_result": "No Slack channels mapped for this repo — add mappings in Integrations",
            "action_confirmed": False,
            "trace_events": traces,
        }

    # Send to all target channels
    results = []
    for ch in target_channels:
        channel_id = ch["id"]
        channel_name = ch.get("name", channel_id)

        traces.append(
            await emit_trace(
                ws_manager, workflow_id, "action", "tool_call",
                {"tool": "send_slack_message", "channel": channel_name},
            )
        )

        try:
            slack_resp = await send_slack_message(channel_id, message_text, bot_token=bot_token)
            sent = slack_resp.get("ok", False)
            results.append(f"#{channel_name}: {'sent' if sent else 'failed'}")
            if not sent:
                logger.error(f"Slack error for #{channel_name}: {slack_resp}")
        except Exception as e:
            results.append(f"#{channel_name}: error ({e})")
            logger.error(f"Slack exception for #{channel_name}: {e}")

    action_result = "Slack: " + ", ".join(results)
    confirmed = any("sent" in r for r in results)

    traces.append(
        await emit_trace(
            ws_manager,
            workflow_id,
            "action",
            "result",
            {"action_result": action_result, "confirmed": confirmed},
        )
    )

    return {
        "action_type": "slack",
        "action_result": action_result,
        "action_confirmed": confirmed,
        "slack_message": message_text,
        "trace_events": traces,
    }
