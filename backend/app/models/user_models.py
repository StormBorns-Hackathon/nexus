from sqlalchemy import Column, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=True)  # null for GitHub-only users
    github_id = Column(String(50), unique=True, nullable=True, index=True)
    github_access_token = Column(String(512), nullable=True)
    github_username = Column(String(255), nullable=True, index=True)
    avatar_url = Column(String(512), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
