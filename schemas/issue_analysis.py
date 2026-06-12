from pydantic import BaseModel, Field
from typing import List


class IssueAnalysis(BaseModel):
    problem_summary: str
    expected_behavior: str
    acceptance_criteria: List[str] = Field(default_factory=list)
    suspected_components: List[str] = Field(default_factory=list)
    open_questions: List[str] = Field(default_factory=list)
    repository_search_terms: List[str] = Field(default_factory=list)