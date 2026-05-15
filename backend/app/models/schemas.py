# app/models/schemas.py
from pydantic import BaseModel
from uuid import UUID
from typing import Any, Dict, Optional
from datetime import datetime
from app.models.workflow_models import WorkflowStatus


class WebhookIngestRequest(BaseModel):
    source: str
    event_type: str
    payload: Dict[str, Any]


class WorkflowCreateResponse(BaseModel):
    workflow_id: UUID
    status: WorkflowStatus
    trace_url: str


class WorkflowSummary(BaseModel):
    id: UUID
    signal_type: str
    status: WorkflowStatus
    result_summary: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]


class WorkflowListResponse(BaseModel):
    workflows: list[WorkflowSummary]


class WorkflowDetail(BaseModel):
    workflow: WorkflowSummary
    steps: list[Dict[str, Any]]


class ManualTriggerRequest(BaseModel):
    scenario: str
    custom_payload: dict | None = None
