import sys
from schemas.state import IssueState
from graph import create_graph

def main():
    # Default provider
    provider = "gemini"
    
    # Parse CLI arguments
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if arg in ["gemini", "groq"]:
            provider = arg
        else:
            print(f"Warning: Unsupported provider '{arg}'. Defaulting to 'gemini'.")

    # Initial state
    state = IssueState(
        repo_owner="DakshDashora",
        repo_name="RedGold",
        issue_number=1,
        llm_provider=provider
    )

    print(f"\n=== RUNNING AGENT WITH LANGGRAPH (Provider: {provider.upper()}) ===")

    # Create and compile the graph
    app = create_graph()

    # Execute the graph
    final_state = app.invoke(state)

    print("\n=== FINAL STATE ===")
    print(f"Current Step: {final_state['current_step']}")
    print(f"Files Modified: {len(final_state['approved_changes'])}")
    
    for change in final_state['approved_changes']:
        print(f"- {change['file_path']}")

    if final_state['errors']:
        print("\n=== ERRORS ===")
        for error in final_state['errors']:
            print(f"- {error}")

if __name__ == "__main__":
    main()
