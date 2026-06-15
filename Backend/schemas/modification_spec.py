from pydantic import BaseModel, Field
from typing import List


class FileModification(BaseModel):
    file_path: str

    objective: str

    reason: str


class ModificationSpec(BaseModel):
    summary: str

    modifications: List[FileModification] = Field(
        default_factory=list
    )
