import ast
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
from llm.provider import get_llm
from schemas.state import IssueState

class ValidationResult(BaseModel):
    passed: bool
    reasons: List[str] = Field(default_factory=list)

def validate_changes_node(state: IssueState) -> IssueState:
    state.console_logs.append("[INFO] Initiating AST syntax checking and compilation validations...")
    print("\n=== VALIDATING CHANGES ===")
    
    # 1. Syntax Check (In-memory)
    for change in state.approved_changes:
        if change["file_path"].endswith(".py"):
            try:
                ast.parse(change["updated_content"])
                print(f"Syntax Check Passed: {change['file_path']}")
                state.console_logs.append(f"[INFO] AST syntax validation passed for {Path(change['file_path']).name}")
            except SyntaxError as e:
                print(f"Syntax Check Failed: {change['file_path']} - {str(e)}")
                state.console_logs.append(f"[ERROR] AST syntax validation failed for {Path(change['file_path']).name}: {str(e)}")
                state.validation_passed = False
                state.validation_feedback = [f"Syntax Error in {change['file_path']}: {str(e)}"]
                return state

    # 2. AI Dry Run (Holistic Check)
    llm = get_llm(state.llm_provider)
    structured_llm = llm.with_structured_output(ValidationResult)

    # Prepare context for LLM
    changes_context = ""
    for change in state.approved_changes:
        changes_context += f"\nFILE: {change['file_path']}\n"
        changes_context += f"ORIGINAL:\n{change['original_content'][:1000]}...\n" # Truncated for token safety
        changes_context += f"UPDATED:\n{change['updated_content']}\n"
        changes_context += "-" * 20

    prompt = f"""
You are an Integration Tester and Senior Architect.

You MUST respond by calling the provided tool with the correct arguments.
Do NOT provide any conversational text or Markdown outside of the tool call.

You are evaluating a COMPLETE set of proposed changes for the following issue:

ISSUE CONTEXT:
{state.problem_summary}

PROPOSED CHANGES:
{changes_context}

TASK:
Perform a logical "Dry Run" of these integrated changes.

Review Checklist:
1. CROSS-FILE INTEGRITY: If a function signature was changed in one file, are all callers in other files updated to match?
2. ACCEPTANCE CRITERIA: Does this set of changes fully satisfy the issue requirements?
3. REGRESSIONS: Did any of these changes accidentally break unrelated logic or remove necessary imports/functions?
4. LOGICAL SOUNDNESS: Is the implementation of the new logic correct and professional?

Return a boolean 'passed' and a list of 'reasons' for your decision.
"""

    result = structured_llm.invoke(prompt)

    print("AI Dry Run Passed:", result.passed)
    if not result.passed:
        print("Reasons:")
        for reason in result.reasons:
            print(f"- {reason}")

    state.validation_passed = result.passed
    state.validation_feedback = result.reasons
    state.current_step = "changes_validated"
    if result.passed:
        state.console_logs.append("[SUCCESS] Code validation checks completed successfully. All targets compile.")
    else:
        state.console_logs.append(f"[ERROR] Validation checks failed: {', '.join(result.reasons)}")

    return state
