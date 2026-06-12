from llm.provider import get_llm

from schemas.state import IssueState
from schemas.investigation import (
    InvestigationResult,
)

from tools.repository.read_many import (
    read_many_files,
)


def investigate_issue_node(
    state: IssueState,
) -> IssueState:
    llm = get_llm(state.llm_provider)
    structured_llm = llm.with_structured_output(
        InvestigationResult
    )

    file_context = read_many_files(
        state.selected_files
    )

    prompt = f"""
You are a senior software engineer.

Your task is to investigate how the repository currently works and provide a structured investigation result.
You MUST respond by calling the provided tool with the correct arguments.
Do NOT provide any conversational text or Markdown outside of the tool call.

Your task is NOT to write code.

Your task is to investigate
how the repository currently works.

ISSUE TITLE:
{state.issue_title}

ISSUE DESCRIPTION:
{state.issue_body}

PROBLEM SUMMARY:
{state.problem_summary}

FILES:

{file_context}

Determine:

1. What part of the codebase is involved.
2. What functions are likely involved.
3. What classes are likely involved.
4. What the probable root cause is.
5. How confident you are.

Do NOT invent files.

Base reasoning only on the supplied code.
"""

    result = structured_llm.invoke(
        prompt
    )

    state.root_cause_analysis = (
        result.root_cause_analysis
    )

    state.affected_functions = (
        result.affected_functions
    )

    state.affected_classes = (
        result.affected_classes
    )

    state.confidence = (
        result.confidence
    )

    state.current_step = (
        "issue_investigated"
    )

    return state
