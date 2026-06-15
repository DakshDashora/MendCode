from pathlib import Path
from collections import defaultdict


IGNORED_DIRS = {
    ".git",
    "tests",
    "docs",
    "__pycache__",
    ".venv",
    "venv",
    ".pytest_cache",
    ".mypy_cache",
}


def should_ignore(path: Path) -> bool:
    return any(part in IGNORED_DIRS for part in path.parts)


def search_repository(
    repo_path: str,
    search_terms: list[str],
    max_results: int = 20,
) -> list[str]:

    repo = Path(repo_path)

    scores = defaultdict(int)

    for file_path in repo.rglob("*"):

        if should_ignore(file_path):
            continue

        if not file_path.is_file():
            continue

        score = 0

        file_name_lower = file_path.name.lower()

        for term in search_terms:
            if term.lower() in file_name_lower:
                score += 10

        try:
            content = file_path.read_text(
                encoding="utf-8",
            )
        except Exception:
            continue

        content_lower = content.lower()

        for term in search_terms:

            count = content_lower.count(
                term.lower()
            )

            score += count

        if score > 0:
            scores[str(file_path)] = score

    ranked_files = sorted(
        scores.items(),
        key=lambda x: x[1],
        reverse=True,
    )

    return [
        path
        for path, _ in ranked_files[:max_results]
    ]