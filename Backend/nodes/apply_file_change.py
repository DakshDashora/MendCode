from schemas.state import IssueState
from pathlib import Path

from tools.repository.write import (
    write_file,
)


def apply_file_change_node(
    state: IssueState,
) -> IssueState:

    state.console_logs.append("[INFO] Writing approved surgical code modifications to local workspace disk...")
    if not state.approved_changes:
        print("No approved changes to apply.")
        state.console_logs.append("[WARNING] No approved changes to apply.")
        return state

    for change in state.approved_changes:
        print(f"Applying change to: {change['file_path']}")
        write_file(
            state.local_repo_path,
            change["file_path"],
            change["updated_content"],
        )
        state.console_logs.append(f"[INFO] Applied surgical edits to: {Path(change['file_path']).name}")

    state.current_step = (
        "files_applied"
    )
    state.console_logs.append("[SUCCESS] File edits successfully committed to workspace files.")

    return state
