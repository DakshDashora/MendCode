from langgraph.graph import StateGraph, END
from schemas.state import IssueState
from nodes.fetch_issue import fetch_issue_node
from nodes.analyze_issue import analyze_issue_node
from nodes.clone_repository import clone_repository_node
from nodes.select_relevant_files import select_relevant_files_node
from nodes.investigate_issue import investigate_issue_node
from nodes.create_modification_spec import create_modification_spec_node
from nodes.generate_file_change import generate_file_change_node
from nodes.review_changes import review_changes_node
from nodes.review_generated_change import review_generated_change_node
from nodes.apply_file_change import apply_file_change_node
from nodes.validate_changes import validate_changes_node
from nodes.create_pr import create_pr_node

MAX_RETRIES = 3

def review_router(state: IssueState):
    if state.review_approved:
        # If there are more targets to process
        if state.current_target_index + 1 < len(state.modification_targets):
            return "next_target"
        else:
            return "validate"
    else:
        if state.retry_count < MAX_RETRIES:
            return "retry"
        else:
            return "failed"

def validation_router(state: IssueState):
    if state.validation_passed:
        return "apply"
    else:
        if state.validation_retry_count < MAX_RETRIES:
            return "fix_validation"
        else:
            return "failed"

def planning_router(state: IssueState):
    if not state.modification_targets:
        print("Error: No valid modification targets identified. Stopping.")
        return "failed"
    return "continue"

def increment_target_node(state: IssueState):
    state.current_target_index += 1
    state.retry_count = 0
    state.review_feedback = []
    return state

def increment_retry_node(state: IssueState):
    state.retry_count += 1
    return state

def prepare_validation_retry_node(state: IssueState):
    state.validation_retry_count += 1
    state.current_target_index = 0 # Restart generation from first file with new holistic feedback
    state.retry_count = 0
    state.review_feedback = state.validation_feedback # Pass validation errors as feedback
    state.approved_changes = [] # Clear previously approved but logically flawed changes
    state.proposed_changes = []
    return state

def create_graph():
    workflow = StateGraph(IssueState)

    # Add Nodes
    workflow.add_node("fetch_issue", fetch_issue_node)
    workflow.add_node("analyze_issue", analyze_issue_node)
    workflow.add_node("clone_repository", clone_repository_node)
    workflow.add_node("select_relevant_files", select_relevant_files_node)
    workflow.add_node("investigate_issue", investigate_issue_node)
    workflow.add_node("create_modification_spec", create_modification_spec_node)
    workflow.add_node("generate_file_change", generate_file_change_node)
    workflow.add_node("review_changes", review_changes_node)
    workflow.add_node("review_generated_change", review_generated_change_node)
    workflow.add_node("validate_changes", validate_changes_node)
    workflow.add_node("apply_file_change", apply_file_change_node)
    workflow.add_node("create_pr", create_pr_node)
    
    workflow.add_node("increment_target", increment_target_node)
    workflow.add_node("increment_retry", increment_retry_node)
    workflow.add_node("prepare_validation_retry", prepare_validation_retry_node)

    # Define Edges
    workflow.set_entry_point("fetch_issue")
    workflow.add_edge("fetch_issue", "analyze_issue")
    workflow.add_edge("analyze_issue", "clone_repository")
    workflow.add_edge("clone_repository", "select_relevant_files")
    workflow.add_edge("select_relevant_files", "investigate_issue")
    workflow.add_edge("investigate_issue", "create_modification_spec")
    
    # Planning Router (Safety check)
    workflow.add_conditional_edges(
        "create_modification_spec",
        planning_router,
        {
            "continue": "generate_file_change",
            "failed": END
        }
    )

    workflow.add_edge("generate_file_change", "review_changes")
    workflow.add_edge("review_changes", "review_generated_change")

    # Review Router
    workflow.add_conditional_edges(
        "review_generated_change",
        review_router,
        {
            "next_target": "increment_target",
            "validate": "validate_changes",
            "retry": "increment_retry",
            "failed": END
        }
    )

    # Validation Router
    workflow.add_conditional_edges(
        "validate_changes",
        validation_router,
        {
            "apply": "apply_file_change",
            "fix_validation": "prepare_validation_retry",
            "failed": END
        }
    )

    workflow.add_edge("increment_target", "generate_file_change")
    workflow.add_edge("increment_retry", "generate_file_change")
    workflow.add_edge("prepare_validation_retry", "generate_file_change")
    workflow.add_edge("apply_file_change", "create_pr")
    workflow.add_edge("create_pr", END)

    return workflow.compile()
