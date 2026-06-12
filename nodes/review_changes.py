from schemas.state import IssueState

from tools.repository.diff import (
    generate_diff,
)


def review_changes_node(
    state: IssueState,
) -> IssueState:

    print(
        "\n=== PROPOSED CHANGES ==="
    )

    for change in (
        state.proposed_changes
    ):

        print(
            "\nFile:",
            change["file_path"],
        )

        print(
            "\nObjective:",
            change["objective"],
        )

        print(
            "\nDiff:\n"
        )

        print(
            generate_diff(
                change[
                    "original_content"
                ],
                change[
                    "updated_content"
                ],
            )
        )

    return state