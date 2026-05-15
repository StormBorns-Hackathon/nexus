"""Custom outgoing webhook model — users register URLs to receive pipeline results."""

from sqlalchemy import Column, String, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from .database import Base


class CustomWebhook(Base):
    __tablename__ = "custom_webhooks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)          # e.g. "My Discord Bot"
    url = Column(String(2048), nullable=False)           # target URL to POST to
    secret = Column(String(255), nullable=True)          # optional signing secret
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
