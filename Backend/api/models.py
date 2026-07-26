from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from api.dbconfig import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False) # "admin" or "user"
    github_token = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_otp = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    jobs = relationship("Job", back_populates="user")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    repo_owner = Column(String, nullable=False)
    repo_name = Column(String, nullable=False)
    issue_number = Column(Integer, nullable=False)
    issue_title = Column(String, nullable=True)
    problem_summary = Column(Text, nullable=True)
    root_cause_analysis = Column(Text, nullable=True)
    llm_provider = Column(String, default="gemini")
    status = Column(String, default="PENDING")
    current_step = Column(String, nullable=True)
    pr_url = Column(String, nullable=True)
    approved_changes = Column(Text, nullable=True)  # JSON string of changes
    error_message = Column(Text, nullable=True)
    console_logs = Column(Text, nullable=True)  # JSON string of logs
    delete_warning_sent = Column(Boolean, default=False, nullable=False)
    warning_sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="jobs")
