from pydantic import BaseModel, Field
from typing import List


class InvestigationResult(BaseModel):
    root_cause_analysis: str

    affected_functions: List[str] = Field(
        default_factory=list
    )

    affected_classes: List[str] = Field(
        default_factory=list
    )

    relevant_files: List[str] = Field(
        default_factory=list
    )

    investigation_notes: List[str] = Field(
        default_factory=list
    )

    confidence: float
