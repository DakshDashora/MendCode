from pydantic import BaseModel


class FileChange(BaseModel):
    file_path: str

    objective: str

    original_content: str

    updated_content: str

    change_summary: str