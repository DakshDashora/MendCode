from pathlib import Path

from llm.provider import get_llm

from schemas.file_selection import (
    FileSelection,
)
from schemas.state import IssueState

from tools.repository.tree import (
    get_repository_tree,
)


def select_relevant_files_node(
    state: IssueState,
) -> IssueState:
    state.console_logs.append("[INFO] Inspecting repository tree structure to identify files of interest...")
    llm = get_llm(state.llm_provider)
    structured_llm = llm.with_structured_output(
        FileSelection
    )

    repository_tree = get_repository_tree(
        state.local_repo_path
    )

    tree_text = "\n".join(
        repository_tree
    )

    prompt = f"""
You are a senior software engineer.

Your task is to identify which files should be investigated first and provide a structured file selection.
You MUST respond by calling the provided tool with the correct arguments.
Do NOT provide any conversational text or Markdown outside of the tool call.

ISSUE TITLE:
{state.issue_title}

ISSUE DESCRIPTION:
{state.issue_body}

PROBLEM SUMMARY:
{state.problem_summary}

SEARCH TERMS:
{state.repository_search_terms}

REPOSITORY TREE:

{tree_text}

Rules:

1. Prefer source code files.
2. Prefer backend files over frontend files
   if the issue is backend-related.
3. Avoid lockfiles.
4. Avoid build files.
5. Avoid documentation files.
6. Avoid generated files.
7. Select at most 5 files.

Return only files that are worth
reading to investigate the issue.
"""

    selection = structured_llm.invoke(
        prompt
    )

    resolved_files = []

    for relative_path in (
        selection.selected_files
    ):

        absolute_path = str(
            Path(
                state.local_repo_path
            )
            / relative_path
        )

        resolved_files.append(
            absolute_path
        )

    state.selected_files = (
        resolved_files
    )

    state.exploration_reasoning = (
        selection.reasoning
    )

    state.current_step = (
        "files_selected"
    )
    state.console_logs.append(f"[SUCCESS] Identified target code files: {', '.join([Path(f).name for f in state.selected_files])}")

    return state
