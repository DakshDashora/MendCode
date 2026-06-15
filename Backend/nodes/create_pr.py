from llm.provider import get_llm
from schemas.state import IssueState
from tools.github.client import GitHubClient
from tools.repository.git import create_branch, commit_changes, push_branch, add_remote
import uuid
import os
import time
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

def create_pr_node(state: IssueState) -> IssueState:
    print("\n=== CREATING PULL REQUEST (FORKING WORKFLOW) ===")

    llm = get_llm(state.llm_provider)
    client = GitHubClient(owner=state.repo_owner, repo=state.repo_name, token=state.github_token)
    
    # 1. Get authenticated user
    current_user = client.get_current_user()
    user_login = current_user["login"]
    print(f"Authenticated as: {user_login}")

    # 2. Generate PR Title and Body
    changes_summary = "\n".join([f"- {c['file_path']}: {c['objective']}" for c in state.approved_changes])
    
    prompt = f"""
You are a senior software engineer preparing a Pull Request.
You have successfully fixed the following issue:

ISSUE: {state.issue_title}
SUMMARY: {state.problem_summary}

CHANGES MADE:
{changes_summary}

TASK:
Generate a professional Pull Request title and a detailed description in Markdown format.
Return the response in this format:
TITLE: <pr_title>
BODY: <body>
"""
    
    response = llm.invoke(prompt)
    content = response.content
    
    try:
        pr_title = content.split("TITLE:")[1].split("BODY:")[0].strip()
        pr_body = content.split("BODY:")[1].strip()
    except Exception:
        pr_title = f"Fix for Issue #{state.issue_number}: {state.issue_title}"
        pr_body = f"This PR addresses the issue: {state.issue_title}\n\nSummary of changes:\n{changes_summary}"

    # 3. Determine Workflow (Direct vs Fork)
    branch_name = f"fix/issue-{state.issue_number}-{uuid.uuid4().hex[:6]}"
    create_branch(state.local_repo_path, branch_name)
    commit_changes(state.local_repo_path, pr_title)

    token = state.github_token or os.getenv("GITHUB_TOKEN")

    if user_login.lower() == state.repo_owner.lower():
        print("Repo owner detected. Using direct push workflow.")
        # Ensure the origin remote has the correct standard URL
        repo_url = f"https://github.com/{state.repo_owner}/{state.repo_name}.git"
        add_remote(state.local_repo_path, "origin", repo_url)
        
        push_branch(state.local_repo_path, branch_name, remote_name="origin", token=token)
        head_ref = branch_name
    else:
        print(f"Contribution detected. Forking {state.repo_owner}/{state.repo_name}...")
        client.create_fork()
        
        # Give GitHub a few seconds to provision the fork initially
        print("Waiting for fork to provision...")
        time.sleep(5)
        
        fork_url = f"https://github.com/{user_login}/{state.repo_name}.git"
        
        add_remote(state.local_repo_path, "fork", fork_url)
        print(f"Pushing branch to fork: {user_login}/{state.repo_name}")
        push_branch(state.local_repo_path, branch_name, remote_name="fork", token=token)
        
        # Head must be in format 'username:branch' for cross-repo PRs
        head_ref = f"{user_login}:{branch_name}"

    # 4. Open Pull Request
    print(f"Opening Pull Request: {head_ref} -> {state.repo_owner}:main")
    
    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=2, min=4, max=30),
        reraise=True
    )
    def attempt_create_pr():
        try:
            return client.create_pull_request(
                title=pr_title,
                body=pr_body,
                head=head_ref,
                base="main"
            )
        except Exception as e:
            if "fork" in str(e).lower() or "No commits between" in str(e):
                print(f"PR creation failed (likely sync delay), retrying... Error: {e}")
                raise e
            # Raise non-retryable exceptions immediately
            print(f"Fatal PR creation error: {e}")
            raise e

    try:
        pr_result = attempt_create_pr()
        pr_url = pr_result.get('html_url')
        print(f"PR Created Successfully: {pr_url}")
        state.pr_url = pr_url
    except Exception as e:
        print(f"Error creating PR after retries: {e}")

    state.pr_title = pr_title
    state.pr_body = pr_body
    state.current_step = "pr_created"
    
    return state
