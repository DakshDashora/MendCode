from schemas.state import IssueState
from tools.github.client import GitHubClient


def fetch_issue_node(state: IssueState) -> IssueState:
    state.console_logs.append(f"[INFO] Connecting to GitHub repository: {state.repo_owner}/{state.repo_name}...")
    client = GitHubClient(
        owner=state.repo_owner,
        repo=state.repo_name,
        token=state.github_token
    )

    state.console_logs.append(f"[INFO] Fetching issue metadata for #{state.issue_number}...")
    issue = client.get_issue(state.issue_number)

    state.issue_title = issue["title"]
    state.issue_body = issue["body"]

    state.current_step = "issue_fetched"
    state.console_logs.append(f"[SUCCESS] Retrieved issue #{state.issue_number}: \"{issue['title']}\"")

    return state