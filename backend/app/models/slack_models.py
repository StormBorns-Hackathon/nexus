from sqlalchemy import Column, String, Integer, TIMESTAMP, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from .database import Base


class SlackInstallation(Base):
    __tablename__ = "slack_installations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    team_id = Column(String(50), nullable=False)
    team_name = Column(String(255), nullable=False)
    bot_token = Column(String(512), nullable=False)
    bot_user_id = Column(String(50), nullable=True)
    default_channel_id = Column(String(50), nullable=True)
    default_channel_name = Column(String(255), nullable=True)
    installed_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "team_id", name="uq_user_team"),
    )


class RepoChannelMapping(Base):
    __tablename__ = "repo_channel_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    installation_id = Column(UUID(as_uuid=True), ForeignKey("slack_installations.id"), nullable=False, index=True)
    repo_full_name = Column(String(255), nullable=False)  # e.g. "facebook/react"
    channel_id = Column(String(50), nullable=False)
    channel_name = Column(String(255), nullable=False)  # e.g. "#engineering"
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "installation_id", "repo_full_name", "channel_id", name="uq_user_inst_repo_channel"),
    )


class MonitoredRepo(Base):
    __tablename__ = "monitored_repos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    repo_full_name = Column(String(255), nullable=False)
    github_webhook_id = Column(Integer, nullable=True)  # webhook ID from GitHub API
    webhook_secret = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "repo_full_name", name="uq_user_repo"),
    )
