import os
from pathlib import Path

def write_file(
    base_repo_path: str,
    file_path: str,
    content: str,
) -> None:

    repo_base = Path(base_repo_path).resolve()
    target_path = (repo_base / file_path).resolve()

    # Crucial Security Check: Ensure the target path is inside the repo
    if not str(target_path).startswith(str(repo_base)):
        raise ValueError(f"Security Violation: Attempted Path Traversal to {target_path}")

    # Ensure parent directories exist
    target_path.parent.mkdir(parents=True, exist_ok=True)
    
    target_path.write_text(
        content,
        encoding="utf-8",
    )
