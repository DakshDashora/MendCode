import os
from pathlib import Path
import subprocess
from dotenv import load_dotenv


load_dotenv(override=True)

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_DIR = BACKEND_DIR / "workspace" / "repos"

GIT_ENV = {
    **os.environ,
    "GIT_TERMINAL_PROMPT": "0",
    "GIT_ASKPASS": "true"
}


def clone_repository(
    job_id: str,
    owner: str,
    repo: str,
    token: str | None = None,
) -> str:

    token = token or os.getenv("GITHUB_TOKEN")
    
    # Isolate workspace per job to prevent concurrent race conditions
    job_workspace = WORKSPACE_DIR / job_id
    job_workspace.mkdir(parents=True, exist_ok=True)
    repo_path = job_workspace / repo

    # Use standard URL without embedded credentials
    repo_url = f"https://github.com/{owner}/{repo}.git"

    cmd_base = ["git"]
    if token:
        import base64
        # GitHub supports Basic auth with the token as the password. 
        # The username can be anything (e.g., 'x-access-token' or 'oauth2')
        auth_bytes = f"x-access-token:{token}".encode("utf-8")
        auth_base64 = base64.b64encode(auth_bytes).decode("utf-8")
        cmd_base.extend(["-c", f"http.extraHeader=Authorization: Basic {auth_base64}"])

    if not repo_path.exists():
        subprocess.run(
            cmd_base + [
                "clone",
                repo_url,
                str(repo_path),
            ],
            check=True,
            env=GIT_ENV,
        )

    else:
        # Fetch and reset to ensure we are on a clean, up-to-date main branch
        subprocess.run(cmd_base + ["-C", str(repo_path), "fetch", "origin"], check=True, env=GIT_ENV)
        
        # Try to checkout main, fallback to master if needed
        try:
            subprocess.run(["git", "-C", str(repo_path), "checkout", "main"], check=True, capture_output=True, env=GIT_ENV)
        except subprocess.CalledProcessError:
            subprocess.run(["git", "-C", str(repo_path), "checkout", "master"], check=True, env=GIT_ENV)

        # Get default branch remote tracking name
        branch_r = subprocess.run(["git", "-C", str(repo_path), "branch", "-r"], capture_output=True, text=True, env=GIT_ENV).stdout
        target_branch = "origin/main" if "origin/main" in branch_r else "origin/master"

        subprocess.run(
            [
                "git",
                "-C",
                str(repo_path),
                "reset",
                "--hard",
                target_branch
            ],
            check=True,
            env=GIT_ENV,
        )

    return str(repo_path.resolve())