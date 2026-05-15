from openai import AsyncOpenAI
from app.tools.slack import send_slack_message
from app.tools.email_tool import send_email
from app.services.trace import emit_trace
import json
from dotenv import load_dotenv
import os
from ..services.llm import client

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL_NAME = "openai/gpt-oss-120b:free"
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
SLACK_CHANNEL_ID = os.getenv("SLACK_CHANNEL_ID")

ACTION_SYSTEM_PROMPT = """You are an action agent. Given research findings and
an action plan, compose a professional message to deliver via Slack.
Respond in JSON: {"message": "...", "subject": "..."}"""


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
        if content is None:
            return {"error": "LLM returned empty response in action", "trace_events": traces}
        result = json.loads(content)
    except Exception as e:
        return {"error": str(e), "trace_events": traces}

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

    if SLACK_CHANNEL_ID is None:
        return {"error": "No slack channel id"}

    try:
        if SLACK_BOT_TOKEN:
            slack_resp = await send_slack_message(SLACK_CHANNEL_ID, result["message"])
            confirmed = slack_resp.get("ok", False)
            action_result = f"Slack: {'sent' if confirmed else 'failed'}"
        else:
            action_result = f"[DRY RUN] Would send: {result['message'][:200]}"
            confirmed = True
    except Exception as e:
        action_result = f"Slack failed: {str(e)}"

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
        "trace_events": traces,
    }
