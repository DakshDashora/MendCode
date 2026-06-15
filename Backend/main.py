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
    
    # Use a fixed thread_id for local CLI runs
    config = {"configurable": {"thread_id": "cli_session_1"}}

    # Execute the graph (Phase 1: Analyze, Investigate, Plan, Generate, Review, Validate)
    print("\n=== PHASE 1: ANALYZING AND GENERATING CHANGES ===")
    app.invoke(state, config)

    # Check if the graph is interrupted before apply_file_change
    snapshot = app.get_state(config)
    
    if snapshot.next and "apply_file_change" in snapshot.next:
        current_state = snapshot.values
        print("\n=== PROPOSED CHANGES ===")
        approved_changes = current_state.get('approved_changes', [])
        
        if not approved_changes:
            print("No changes were approved for application.")
        else:
            for change in approved_changes:
                print(f"\n- File: {change['file_path']}")
                print(f"  Objective: {change['objective']}")
        
        print("\n" + "="*40)
        confirm = input("Do you want to APPLY these changes and create a Pull Request? (y/n): ")
        print("="*40)

        if confirm.lower() == 'y':
            print("\n=== PHASE 2: APPLYING CHANGES AND CREATING PR ===")
            # Resume execution by passing None as state
            app.invoke(None, config)
        else:
            print("\nOperation cancelled by user. The changes have not been applied.")
            return

    # Get final state after completion (or if it finished without interrupt somehow)
    final_snapshot = app.get_state(config)
    final_state = final_snapshot.values

    print("\n=== FINAL STATE ===")
    print(f"Current Step: {final_state.get('current_step')}")
    
    approved_changes = final_state.get('approved_changes', [])
    print(f"Files Processed: {len(approved_changes)}")
    
    for change in approved_changes:
        print(f"- {change['file_path']}")

    if final_state.get('errors'):
        print("\n=== ERRORS ===")
        for error in final_state['errors']:
            print(f"- {error}")

if __name__ == "__main__":
    main()
