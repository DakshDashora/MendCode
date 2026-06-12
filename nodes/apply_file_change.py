from schemas.state import IssueState

from tools.repository.write import (
    write_file,
)


def apply_file_change_node(
    state: IssueState,
) -> IssueState:

    if not state.approved_changes:
        print("No approved changes to apply.")
        return state

    for change in state.approved_changes:
        print(f"Applying change to: {change['file_path']}")
        write_file(
            change["file_path"],
            change["updated_content"],
        )

    state.current_step = (
        "files_applied"
    )

    return state
