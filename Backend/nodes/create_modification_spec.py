from llm.provider import get_llm

from schemas.state import IssueState
from schemas.modification_spec import (
    ModificationSpec,
)


def create_modification_spec_node(
    state: IssueState,
) -> IssueState:
    state.console_logs.append("[INFO] Designing modification specification and mapping surgical objectives...")
    llm = get_llm(state.llm_provider)
    structured_llm = llm.with_structured_output(
        ModificationSpec
    )

    prompt = f"""
You are a pragmatic senior software architect.

Your task is to identify which files must be modified and provide a structured modification spec.
You MUST respond by calling the provided tool with the correct arguments.
Do NOT provide any conversational text or Markdown outside of the tool call.

ISSUE: {state.issue_title}
ROOT CAUSE: {state.root_cause_analysis}
AFFECTED COMPONENTS: {state.affected_functions}

AVAILABLE FILES (ABSOLUTE PATHS):
{state.selected_files}

TASK:
Identify the MINIMAL set of files that must be modified to eliminate the root cause while maintaining system integrity.

RULES for Modification Targets:
1. USE ABSOLUTE PATHS. Select only from the AVAILABLE FILES list provided above.
2. SURGICAL PRECISION: Prefer the most localized fix possible.
3. SIMPLICITY: Do not over-engineer.
4. LOGICAL CONSISTENCY: Ensure your plan maintains cross-file compatibility.

Return a summary of the surgical plan and the specific targets using their ABSOLUTE PATHS.
"""

    spec = structured_llm.invoke(
        prompt
    )

    # Resolution step to ensure paths are valid and absolute
    resolved_targets = []
    import os

    for mod in spec.modifications:
        mod_dict = mod.model_dump()
        target_path = mod_dict["file_path"]
        
        found_match = False
        # 1. Check for exact match
        if target_path in state.selected_files:
            resolved_targets.append(mod_dict)
            continue
            
        # 2. Try to match by filename (basename)
        target_filename = os.path.basename(target_path)
        for absolute_path in state.selected_files:
            if os.path.basename(absolute_path) == target_filename:
                mod_dict["file_path"] = absolute_path
                resolved_targets.append(mod_dict)
                found_match = True
                break
        
        if not found_match:
            print(f"Warning: Discarding hallucinated path '{target_path}'")

    state.modification_summary = (
        spec.summary
    )

    state.modification_targets = resolved_targets

    state.current_step = (
        "modification_spec_created"
    )
    state.console_logs.append(f"[SUCCESS] Modification specs created. Planned edits for {len(state.modification_targets)} file(s).")

    return state
