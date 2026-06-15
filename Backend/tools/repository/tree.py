from pathlib import Path


IGNORED_DIRS = {
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    ".pytest_cache",
    ".mypy_cache",
    "node_modules",
}


def get_repository_tree(
    repo_path: str,
    max_files: int = 500,
) -> list[str]:

    repo = Path(repo_path)

    files = []

    for file_path in repo.rglob("*"):

        if not file_path.is_file():
            continue

        if any(
            part in IGNORED_DIRS
            for part in file_path.parts
        ):
            continue

        relative_path = file_path.relative_to(
            repo
        )

        files.append(
            str(relative_path)
        )

        if len(files) >= max_files:
            break

    return sorted(files)
