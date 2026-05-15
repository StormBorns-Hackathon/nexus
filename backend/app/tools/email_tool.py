import httpx
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_EMAIL_ADDRESS", "hello@akshat21.me")


async def send_email(
    to: str,
    subject: str,
    body: str,
    html_body: str | None = None,
) -> dict:
    """Send an email via the Resend API.

    Parameters
    ----------
    to : str
        Recipient email address.
    subject : str
        Email subject line.
    body : str
        Plain-text fallback body.
    html_body : str | None
        Optional HTML body.  When provided, Resend will render the
        rich version in clients that support it and fall back to *body*
        for plain-text clients.
    """
    payload: dict = {
        "from": f"Nexus <{RESEND_FROM_EMAIL}>",
        "to": [to],
        "subject": subject,
        "text": body,
    }
    if html_body:
        payload["html"] = html_body

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.status_code >= 400:
            logger.error("Resend error %s: %s", resp.status_code, resp.text)
        return {"status": resp.status_code}


# ──────────────── PR / Issue notification helpers ────────────────


async def send_pr_review_email(
    reviewer_email: str,
    pr_title: str,
    pr_url: str,
    pr_author: str,
    repo_name: str,
) -> dict:
    """Notify a reviewer that they've been requested to review a PR."""
    subject = f"[{repo_name}] PR Review Requested: {pr_title}"

    plain = (
        f"Hi,\n\n"
        f"{pr_author} has requested your review on a pull request.\n\n"
        f"PR: {pr_title}\n"
        f"Repo: {repo_name}\n"
        f"Link: {pr_url}\n\n"
        f"— Nexus"
    )

    html = f"""\
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px;">
  <h2 style="margin: 0 0 8px; color: #0969da;">🔍 Review Requested</h2>
  <p style="color: #555; margin: 0 0 20px; font-size: 14px;">
    <strong>{pr_author}</strong> has requested your review on a pull request.
  </p>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="padding: 8px 0; color: #666; width: 70px; vertical-align: top;">PR</td>
      <td style="padding: 8px 0; font-weight: 600;">{pr_title}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666; vertical-align: top;">Repo</td>
      <td style="padding: 8px 0;">{repo_name}</td>
    </tr>
  </table>
  <a href="{pr_url}"
     style="display: inline-block; padding: 10px 22px; background: #0969da; color: #fff;
            text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
    View Pull Request &rarr;
  </a>
  <p style="margin-top: 28px; font-size: 12px; color: #999;">Sent by Nexus</p>
</div>"""

    return await send_email(reviewer_email, subject, plain, html_body=html)


async def send_issue_assigned_email(
    assignee_email: str,
    issue_title: str,
    issue_url: str,
    issue_author: str,
    repo_name: str,
) -> dict:
    """Notify an assignee that they've been assigned to an issue."""
    subject = f"[{repo_name}] Issue Assigned: {issue_title}"

    plain = (
        f"Hi,\n\n"
        f"You've been assigned to a new issue by {issue_author}.\n\n"
        f"Issue: {issue_title}\n"
        f"Repo: {repo_name}\n"
        f"Link: {issue_url}\n\n"
        f"— Nexus"
    )

    html = f"""\
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px;">
  <h2 style="margin: 0 0 8px; color: #1a7f37;">📋 Issue Assigned to You</h2>
  <p style="color: #555; margin: 0 0 20px; font-size: 14px;">
    <strong>{issue_author}</strong> assigned you to a new issue.
  </p>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr>
      <td style="padding: 8px 0; color: #666; width: 70px; vertical-align: top;">Issue</td>
      <td style="padding: 8px 0; font-weight: 600;">{issue_title}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666; vertical-align: top;">Repo</td>
      <td style="padding: 8px 0;">{repo_name}</td>
    </tr>
  </table>
  <a href="{issue_url}"
     style="display: inline-block; padding: 10px 22px; background: #1a7f37; color: #fff;
            text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
    View Issue &rarr;
  </a>
  <p style="margin-top: 28px; font-size: 12px; color: #999;">Sent by Nexus</p>
</div>"""

    return await send_email(assignee_email, subject, plain, html_body=html)
