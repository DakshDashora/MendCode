import os
import subprocess
from pathlib import Path

GIT_ENV = {
    **os.environ,
    "GIT_TERMINAL_PROMPT": "0",
    "GIT_ASKPASS": "true"
}

def create_branch(repo_path: str, branch_name: str):
    """
    Creates a new branch in the repository.
    """
    subprocess.run(
        ["git", "-C", repo_path, "checkout", "-b", branch_name],
        check=True,
        env=GIT_ENV,
    )


def add_remote(repo_path: str, remote_name: str, url: str):
    """
    Adds or updates a remote in the repository.
    """
    try:
        subprocess.run(
            ["git", "-C", repo_path, "remote", "add", "--", remote_name, url],
            check=True,
            capture_output=True,
            env=GIT_ENV,
        )
    except subprocess.CalledProcessError:
        subprocess.run(
            ["git", "-C", repo_path, "remote", "set-url", "--", remote_name, url],
            check=True,
            env=GIT_ENV,
        )


def commit_changes(repo_path: str, message: str):
    """
    Stages all changes and creates a commit securely to prevent argument injection.
    """
    # Ensure git user is configured (required for commit)
    subprocess.run(
        ["git", "-C", repo_path, "config", "user.email", "mendcode@example.com"],
        check=True,
        env=GIT_ENV,
    )
    subprocess.run(
        ["git", "-C", repo_path, "config", "user.name", "MendCode"],
        check=True,
        env=GIT_ENV,
    )
    
    subprocess.run(
        ["git", "-C", repo_path, "add", "--", "."],
        check=True,
        env=GIT_ENV,
    )
    subprocess.run(
        ["git", "-C", repo_path, "commit", "-F", "-"],
        input=message.encode('utf-8'),
        check=True,
        env=GIT_ENV,
    )


def push_branch(repo_path: str, branch_name: str, remote_name: str = "origin", token: str | None = None):
    """
    Pushes the branch to the specified remote securely.
    """
    cmd = ["git", "-C", repo_path]
    if token:
        import base64
        auth_bytes = f"x-access-token:{token}".encode("utf-8")
        auth_base64 = base64.b64encode(auth_bytes).decode("utf-8")
        cmd.extend(["-c", f"http.extraHeader=Authorization: Basic {auth_base64}"])
    cmd.extend(["push", remote_name, "--", branch_name])
    
    subprocess.run(
        cmd,
        check=True,
        env=GIT_ENV,
    )
