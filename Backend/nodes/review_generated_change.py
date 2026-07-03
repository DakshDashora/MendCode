from llm.provider import get_llm

from schemas.review_result import (
    ReviewResult,
)
from schemas.state import IssueState


def review_generated_change_node(
    state: IssueState,
) -> IssueState:
    state.console_logs.append("[INFO] Reviewing generated changes against safety and functional alignment rules...")
    llm = get_llm(state.llm_provider)
    structured_llm = llm.with_structured_output(
        ReviewResult
    )

    change = state.proposed_changes[-1]

    prompt = f"""
You are a senior code reviewer evaluating a fix.

You MUST respond by calling the provided tool with the correct arguments.
Do NOT provide any conversational text or Markdown outside of the tool call.

OBJECTIVE: {change["objective"]}
CONTEXT: {state.problem_summary}
ROOT CAUSE: {state.root_cause_analysis}

ORIGINAL: {change["original_content"]}
UPDATED: {change["updated_content"]}

REVIEW CRITERIA:
1. EFFECTIVENESS: Does this change actually solve the core problem described in the ROOT CAUSE?
2. ANTI-LOBOTOMY (CRITICAL): Did the author accidentally delete unrelated code? Compare the functions and imports in the ORIGINAL and UPDATED versions. If major chunks of logic, imports, or unrelated functions are missing, REJECT IMMEDIATELY.
3. PRAGMATISM: Is the solution appropriately simple? (e.g., using os.getenv() for a secret). Reject over-engineered solutions.
4. CORRECTNESS: Is the code syntactically correct? Are imports and function calls valid?
5. HYGIENE: Is the response free of markdown and commentary?

Reject only if the code is logically broken, fails to solve the root cause, or is dangerously over-engineered.
"""

    result = structured_llm.invoke(
        prompt
    )

    print(
        "\n=== REVIEW RESULT ==="
    )

    print(
        "Approved:",
        result.approved
    )

    print(
        "Confidence:",
        result.confidence
    )

    print(
        "\nReasons:"
    )

    for reason in result.reasons:
        print("-", reason)

    state.review_approved = result.approved
    state.review_feedback = result.reasons
    state.review_confidence = result.confidence

    if result.approved:
        state.approved_changes.append(change)

    state.current_step = (
        "change_reviewed"
    )
    if result.approved:
        state.console_logs.append(f"[SUCCESS] Changes approved by reviewer. Confidence: {int((result.confidence or 0.9)*100)}%")
    else:
        state.console_logs.append(f"[WARNING] Changes rejected by reviewer. Reasons: {', '.join(result.reasons or [])}")

    return state
