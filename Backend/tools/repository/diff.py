import difflib


def generate_diff(
    original: str,
    updated: str,
) -> str:

    return "".join(
        difflib.unified_diff(
            original.splitlines(
                keepends=True
            ),
            updated.splitlines(
                keepends=True
            ),
            fromfile="original",
            tofile="updated",
        )
    )