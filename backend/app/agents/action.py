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
an action plan, write the content for a Slack report.
Return plain text fields only. Do not use Markdown, bullets, headings with #,
code fences, tables, bold, italics, or link formatting inside field values.
Always include a useful summary even if research is sparse.
Respond in JSON: {"summary": "...", "recommended_action": "...", "subject": "..."}"""


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

    return _format_slack_report(
        signal,
        summary,
        _plain_text(state.get("action_plan"))
        or "Review the signal and follow up with the owner.",
    )


def _format_slack_report(signal: dict, summary: str, recommended_action: str) -> str:
    lines = [
        "*Nexus Pipeline Report*",
        "",
        f"*Signal:* {_plain_text(signal.get('title')) or 'Unknown'}",
        f"*Repo:* {_plain_text(signal.get('repo')) or 'N/A'}",
        f"*URL:* {_plain_text(signal.get('url')) or 'N/A'}",
    ]

    details = []
    if signal.get("state"):
        details.append(f"State: {_plain_text(signal.get('state'))}")
    if signal.get("author"):
        details.append(f"Author: {_plain_text(signal.get('author'))}")
    if signal.get("changed_files") is not None:
        details.append(
            f"Change: {signal.get('changed_files', 0)} files, "
            f"+{signal.get('additions', 0)} / -{signal.get('deletions', 0)}"
        )
    if details:
        lines.append(f"*Details:* {' | '.join(details)}")

    lines.extend(
        [
            "",
            "*Summary:*",
            _plain_text(summary)[:1500] or "No summary was generated.",
            "",
            "*Recommended action:*",
            _plain_text(recommended_action)[:700]
            or "Review the signal and follow up with the owner.",
        ]
    )
    return "\n".join(lines)


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

    # Try LLM to compose the body copy; format the Slack report ourselves.
    summary_text = None
    recommended_action = None
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
            summary_text = _plain_text(
                result.get("summary") or result.get("message") or ""
            )
            recommended_action = _plain_text(result.get("recommended_action") or "")
    except Exception as e:
        logger.error(f"Action LLM failed: {e}")

    if not summary_text:
        message_text = _fallback_message(state)
    else:
        message_text = _format_slack_report(
            state.get("signal_payload", {}),
            summary_text,
            recommended_action or state.get("action_plan", ""),
        )

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
