from llm.provider import get_llm
from schemas.state import IssueState
from tools.github.client import GitHubClient
from tools.repository.git import create_branch, commit_changes, push_branch, add_remote
import uuid
import os
import time

def create_pr_node(state: IssueState) -> IssueState:
    print("\n=== CREATING PULL REQUEST (FORKING WORKFLOW) ===")
    
    llm = get_llm(state.llm_provider)
    client = GitHubClient(owner=state.repo_owner, repo=state.repo_name)
    
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

    if user_login.lower() == state.repo_owner.lower():
        print("Repo owner detected. Using direct push workflow.")
        push_branch(state.local_repo_path, branch_name, remote_name="origin")
        head_ref = branch_name
    else:
        print(f"Contribution detected. Forking {state.repo_owner}/{state.repo_name}...")
        client.create_fork()
        
        # Give GitHub a few seconds to provision the fork
        print("Waiting for fork to provision...")
        time.sleep(5)
        
        token = os.getenv("GITHUB_TOKEN")
        fork_url = f"https://x-access-token:{token}@github.com/{user_login}/{state.repo_name}.git"
        
        add_remote(state.local_repo_path, "fork", fork_url)
        print(f"Pushing branch to fork: {user_login}/{state.repo_name}")
        push_branch(state.local_repo_path, branch_name, remote_name="fork")
        
        # Head must be in format 'username:branch' for cross-repo PRs
        head_ref = f"{user_login}:{branch_name}"

    # 4. Open Pull Request
    print(f"Opening Pull Request: {head_ref} -> {state.repo_owner}:main")
    
    try:
        pr_result = client.create_pull_request(
            title=pr_title,
            body=pr_body,
            head=head_ref,
            base="main"
        )
        print(f"PR Created Successfully: {pr_result.get('html_url')}")
    except Exception as e:
        print(f"Error creating PR: {e}")
        # Sometimes fork takes longer
        if "fork" in str(e).lower():
             print("Retrying PR creation in 10 seconds...")
             time.sleep(10)
             pr_result = client.create_pull_request(
                title=pr_title,
                body=pr_body,
                head=head_ref,
                base="main"
            )
             print(f"PR Created Successfully on retry: {pr_result.get('html_url')}")

    state.pr_title = pr_title
    state.pr_body = pr_body
    state.current_step = "pr_created"
    
    return state
