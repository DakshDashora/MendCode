from llm.provider import get_llm

from schemas.state import IssueState
from schemas.implementation_plan import (
    ImplementationPlan,
)

from tools.repository.read_many import (
    read_many_files,
)


def create_implementation_plan_node(
    state: IssueState,
) -> IssueState:
    llm = get_llm(state.llm_provider)
    structured_llm = llm.with_structured_output(
        ImplementationPlan
    )

    file_context = read_many_files(
        state.selected_files
    )

    prompt = f"""
You are a senior software engineer.

A root cause investigation has already
been completed.

ISSUE TITLE:
{state.issue_title}

ISSUE DESCRIPTION:
{state.issue_body}

ROOT CAUSE:
{state.root_cause_analysis}

AFFECTED FUNCTIONS:
{state.affected_functions}

FILES:

{file_context}

Create a concrete implementation plan.

Requirements:

1. Explain what should be changed.
2. List ordered implementation steps.
3. List files that must be modified.
4. Mention possible risks.

Do NOT write code.

Do NOT invent files.
"""

    plan = structured_llm.invoke(
        prompt
    )

    state.implementation_plan = (
        plan.steps
    )

    state.current_step = (
        "implementation_planned"
    )

    return state
