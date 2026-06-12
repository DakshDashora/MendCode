from schemas.state import IssueState
from tools.repository.search import search_repository


def explore_repository_node(
    state: IssueState,
) -> IssueState:

    relevant_files = search_repository(
        repo_path=state.local_repo_path,
        search_terms=state.repository_search_terms,
    )

    state.relevant_files = relevant_files

    state.current_step = "repository_explored"

    return state
