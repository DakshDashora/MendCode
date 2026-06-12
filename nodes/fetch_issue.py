from schemas.state import IssueState
from tools.github.client import GitHubClient


def fetch_issue_node(state: IssueState) -> IssueState:
    client = GitHubClient(
        owner=state.repo_owner,
        repo=state.repo_name,
    )

    issue = client.get_issue(state.issue_number)

    state.issue_title = issue["title"]
    state.issue_body = issue["body"]

    state.current_step = "issue_fetched"

    return state