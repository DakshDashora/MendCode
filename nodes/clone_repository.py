from schemas.state import IssueState
from tools.repository.clone import clone_repository


def clone_repository_node(
    state: IssueState,
) -> IssueState:

    repo_path = clone_repository(
        owner=state.repo_owner,
        repo=state.repo_name,
    )

    state.local_repo_path = repo_path

    state.current_step = "repository_cloned"

    return state