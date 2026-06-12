from pydantic import BaseModel, Field
from typing import List


class FileModification(BaseModel):
    file_path: str
    objective: str


class ImplementationPlan(BaseModel):
    summary: str

    steps: List[str] = Field(
        default_factory=list
    )

    modifications: List[FileModification] = Field(
        default_factory=list
    )

    risks: List[str] = Field(
        default_factory=list
    )