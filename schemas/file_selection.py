from pydantic import BaseModel, Field
from typing import List


class FileSelection(BaseModel):
    selected_files: List[str] = Field(
        default_factory=list
    )

    reasoning: str
