from pathlib import Path


def read_file(
    file_path: str,
    max_chars: int = 15000,
) -> str:

    path = Path(file_path)

    content = path.read_text(
        encoding="utf-8",
    )

    return content[:max_chars]