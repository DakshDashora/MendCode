from llm.provider import get_llm

from schemas.state import IssueState

from tools.repository.read import (
    read_file,
)


def generate_file_change_node(
    state: IssueState,
) -> IssueState:
    llm = get_llm(state.llm_provider)

    target = state.modification_targets[state.current_target_index]

    file_path = target["file_path"]

    objective = target["objective"]

    original_content = read_file(
        file_path
    )

    feedback_section = ""
    if state.retry_count > 0 and state.review_feedback:
        feedback_text = "\n".join([f"- {r}" for r in state.review_feedback])
        feedback_section = f"\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED.\nFeedback:\n{feedback_text}\n\nPlease fix these issues in your next response."

    prompt = f"""
You are a senior software engineer performing a surgical modification.

FILE: {file_path}
OBJECTIVE: {objective}
CONTEXT: {state.problem_summary}

TASK:
Modify this file to satisfy the objective.

CRITICAL RULES:
1. FUNCTIONAL PARITY: You MUST PRESERVE every single function, class, import, and logic block that is not directly related to the objective. 
2. NO DELETIONS: Do not delete code that you don't understand or that seems "unrelated." If it was there before, and it doesn't violate the objective, it MUST be there after.
3. SURGICAL MODIFICATION: Only change the lines necessary to satisfy the objective. 
4. PRAGMATISM: Use standard patterns (like os.getenv). Do not over-engineer.
5. CLEANLINESS: Return ONLY the COMPLETE updated source code. No markdown, no commentary.

EXISTING FILE CONTENT:
{original_content}{feedback_section}
"""

    response = llm.invoke(
        prompt
    )

    updated_content = (
        response.content
        .replace("```python", "")
        .replace("```", "")
        .strip()
    )

    state.proposed_changes.append(
        {
            "file_path": file_path,
            "objective": objective,
            "original_content": original_content,
            "updated_content": updated_content,
            "change_summary": objective,
        }
    )

    state.current_step = (
        "change_generated"
    )

    return state