from pydantic import BaseModel, Field
from typing import List


class ReviewResult(BaseModel):
    approved: bool

    confidence: float

    reasons: List[str] = Field(
        default_factory=list
    )