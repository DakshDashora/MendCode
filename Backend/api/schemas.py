from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    role: str
    github_token: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class JobBase(BaseModel):
    repo_owner: str
    repo_name: str
    issue_number: int
    llm_provider: str = "gemini"

class JobCreate(JobBase):
    pass

class JobResponse(JobBase):
    id: str
    user_id: str
    status: str
    issue_title: Optional[str] = None
    problem_summary: Optional[str] = None
    root_cause_analysis: Optional[str] = None
    current_step: Optional[str] = None
    pr_url: Optional[str] = None
    approved_changes: Optional[List[dict]] = None
    error_message: Optional[str] = None
    console_logs: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
