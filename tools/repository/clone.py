import os
from pathlib import Path
import subprocess
from dotenv import load_dotenv


load_dotenv(override=True)

WORKSPACE_DIR = Path("workspace/repos")


def clone_repository(
    owner: str,
    repo: str,
) -> str:

    WORKSPACE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    repo_path = WORKSPACE_DIR / repo
    token = os.getenv("GITHUB_TOKEN")

    if token:
        repo_url = f"https://x-access-token:{token}@github.com/{owner}/{repo}.git"
    else:
        repo_url = f"https://github.com/{owner}/{repo}.git"

    if not repo_path.exists():

        subprocess.run(
            [
                "git",
                "clone",
                repo_url,
                str(repo_path),
            ],
            check=True,
        )

    else:
        # Update remote URL in case token changed or was added
        subprocess.run(
            [
                "git",
                "-C",
                str(repo_path),
                "remote",
                "set-url",
                "origin",
                repo_url,
            ],
            check=True,
        )

        # Fetch and reset to ensure we are on a clean, up-to-date main branch
        subprocess.run(["git", "-C", str(repo_path), "fetch", "origin"], check=True)
        
        # Try to checkout main, fallback to master if needed
        try:
            subprocess.run(["git", "-C", str(repo_path), "checkout", "main"], check=True, capture_output=True)
        except subprocess.CalledProcessError:
            subprocess.run(["git", "-C", str(repo_path), "checkout", "master"], check=True)

        subprocess.run(
            [
                "git",
                "-C",
                str(repo_path),
                "reset",
                "--hard",
                "origin/main" if "main" in subprocess.run(["git", "-C", str(repo_path), "branch", "-r"], capture_output=True, text=True).stdout else "origin/master"
            ],
            check=True,
        )

    return str(repo_path.resolve())