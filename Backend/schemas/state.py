from pydantic import BaseModel, Field
from typing import List, Optional


class IssueState(BaseModel):
    """
    State definition for the MendCode LangGraph Agentic PR Pipeline.

    This model serves as the single source of truth passed across all nodes in the state graph.
    It contains:
    - User input parameters (target repository details, auth token, select LLM option).
    - Fetched GitHub issue description metadata.
    - Derived issue analysis structures (acceptance criteria, search terms).
    - Workspace directories and target files selected by the LLM.
    - Code investigation outcomes, modification specifications, and generated file edits.
    - Loop metrics tracking LLM-based review retries and AST validation retries.
    - Real-time logging telemetry synced to the SQL relational database.
    """
    # User Input
    repo_owner: str
    repo_name: str
    issue_number: int
    llm_provider: str = "gemini"
    github_token: Optional[str] = None

    # Raw GitHub Issue Data
    issue_title: Optional[str] = None
    issue_body: Optional[str] = None

    # Issue Understanding
    problem_summary: Optional[str] = None
    expected_behavior: Optional[str] = None

    acceptance_criteria: List[str] = Field(
        default_factory=list
    )

    suspected_components: List[str] = Field(
        default_factory=list
    )

    open_questions: List[str] = Field(
        default_factory=list
    )

    repository_search_terms: List[str] = Field(
        default_factory=list
    )

    # Repository Exploration
    local_repo_path: Optional[str] = None

    relevant_files: List[str] = Field(
        default_factory=list
    )

    selected_files: List[str] = Field(
        default_factory=list
    )

    exploration_reasoning: Optional[str] = None

    # Investigation
    investigation_summary: Optional[str] = None

    root_cause_analysis: Optional[str] = None

    affected_functions: List[str] = Field(
        default_factory=list
    )

    affected_classes: List[str] = Field(
        default_factory=list
    )

    confidence: Optional[float] = None

    # Planning
    implementation_plan: List[str] = Field(
        default_factory=list
    )

    # Code Generation
    modified_files: List[str] = Field(
        default_factory=list
    )

    # Validation
    validation_results: List[str] = Field(
        default_factory=list
    )

    # Pull Request
    pr_title: Optional[str] = None
    pr_body: Optional[str] = None
    pr_url: Optional[str] = None

    # Execution Metadata
    current_step: Optional[str] = None

    errors: List[str] = Field(
        default_factory=list
    )

    console_logs: List[str] = Field(
        default_factory=list
    )

    modification_summary: str | None = None

    modification_targets: List[dict] = Field(
        default_factory=list
    )

    generated_file_path: Optional[str] = None

    generated_file_content: Optional[str] = None

    proposed_changes: List[dict] = Field(
        default_factory=list
    )

    review_approved: Optional[bool] = None

    review_confidence: Optional[float] = None

    current_target_index: int = 0

    retry_count: int = 0

    review_feedback: List[str] = Field(
        default_factory=list
    )

    approved_changes: List[dict] = Field(
        default_factory=list
    )

    validation_passed: Optional[bool] = None

    validation_feedback: List[str] = Field(
        default_factory=list
    )

    validation_retry_count: int = 0

    user_approved: bool = False
