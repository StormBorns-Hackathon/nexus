from sqlalchemy import Column, String, Enum, JSON, TIMESTAMP, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum

from .database import Base

class WorkflowStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    signal_type = Column(String(50), nullable=False)
    signal_payload = Column(JSON, nullable=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.pending, nullable=False)
    result_summary = Column(String, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    completed_at = Column(TIMESTAMP(timezone=True), nullable=True)

class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id"), nullable=False)
    agent_name = Column(String(50), nullable=False)
    step_type = Column(String(50), nullable=False)       
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    tool_name = Column(String(100), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
