from schemas.state import IssueState
from tools.repository.clone import clone_repository
from langchain_core.runnables import RunnableConfig
import uuid


def clone_repository_node(
    state: IssueState,
    config: RunnableConfig,
) -> IssueState:
    state.console_logs.append(f"[INFO] Cloning repository '{state.repo_owner}/{state.repo_name}' to local workspace...")
    job_id = config.get("configurable", {}).get("thread_id", str(uuid.uuid4()))

    repo_path = clone_repository(
        job_id=job_id,
        owner=state.repo_owner,
        repo=state.repo_name,
        token=state.github_token
    )

    state.local_repo_path = repo_path

    state.current_step = "repository_cloned"
    state.console_logs.append(f"[SUCCESS] Repository cloned successfully to workspace path.")

    return state