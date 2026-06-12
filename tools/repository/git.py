import subprocess
from pathlib import Path


def create_branch(repo_path: str, branch_name: str):
    """
    Creates a new branch in the repository.
    """
    subprocess.run(
        ["git", "-C", repo_path, "checkout", "-b", branch_name],
        check=True,
    )


def add_remote(repo_path: str, remote_name: str, url: str):
    """
    Adds or updates a remote in the repository.
    """
    try:
        subprocess.run(
            ["git", "-C", repo_path, "remote", "add", remote_name, url],
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError:
        subprocess.run(
            ["git", "-C", repo_path, "remote", "set-url", remote_name, url],
            check=True,
        )


def commit_changes(repo_path: str, message: str):
    """
    Stages all changes and creates a commit.
    """
    # Ensure git user is configured (required for commit)
    subprocess.run(
        ["git", "-C", repo_path, "config", "user.email", "pr-assistant@example.com"],
        check=True,
    )
    subprocess.run(
        ["git", "-C", repo_path, "config", "user.name", "PR Assistant"],
        check=True,
    )
    
    subprocess.run(
        ["git", "-C", repo_path, "add", "."],
        check=True,
    )
    subprocess.run(
        ["git", "-C", repo_path, "commit", "-m", message],
        check=True,
    )


def push_branch(repo_path: str, branch_name: str, remote_name: str = "origin"):
    """
    Pushes the branch to the specified remote.
    """
    subprocess.run(
        ["git", "-C", repo_path, "push", remote_name, branch_name],
        check=True,
    )
