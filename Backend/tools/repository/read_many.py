from tools.repository.read import read_file


def read_many_files(
    file_paths: list[str],
) -> str:

    sections = []

    for file_path in file_paths:

        try:
            content = read_file(file_path)

            sections.append(
                f"""
FILE: {file_path}

{content}
"""
            )

        except Exception:
            continue

    return "\n\n".join(sections)
