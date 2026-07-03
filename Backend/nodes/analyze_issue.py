from schemas.issue_analysis import IssueAnalysis
from schemas.state import IssueState
from llm.provider import get_llm


def analyze_issue_node(
    state: IssueState,
) -> IssueState:
    state.console_logs.append("[INFO] Analyzing issue context and establishing acceptance criteria...")
    llm = get_llm(state.llm_provider)
    structured_llm = llm.with_structured_output(
        IssueAnalysis
    )

    prompt = f"""
You are a senior software engineer.

Your task is to analyze the GitHub issue and provide a structured analysis.
You MUST respond by calling the provided tool with the correct arguments.
Do NOT provide any conversational text or Markdown outside of the tool call.

Analyze the GitHub issue and extract:
1. Problem summary
2. Expected behavior
3. Acceptance criteria
4. Suspected repository components
5. Open questions
6. Repository search terms

Issue Title:
{state.issue_title}

Issue Description:
{state.issue_body}
"""

    analysis = structured_llm.invoke(prompt)

    state.problem_summary = analysis.problem_summary

    state.expected_behavior = analysis.expected_behavior

    state.acceptance_criteria = (
        analysis.acceptance_criteria
    )

    state.suspected_components = (
        analysis.suspected_components
    )

    state.open_questions = (
        analysis.open_questions
    )

    state.repository_search_terms = (
        analysis.repository_search_terms
    )

    state.current_step = "issue_analyzed"
    state.console_logs.append(f"[SUCCESS] Issue analysis complete. Isolated {len(state.acceptance_criteria)} acceptance criteria and {len(state.suspected_components)} suspected modules.")

    return state
