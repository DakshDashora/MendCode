from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import json
import os
from pathlib import Path

from api.dbconfig import get_db, SessionLocal
from api.models import Job, User
from api.schemas import JobCreate, JobResponse, ChangeUpdateRequest
from api.utils.auth import get_current_user, decrypt_token
from graph import create_graph
from schemas.state import IssueState

router = APIRouter(prefix="/jobs", tags=["Jobs"])

def run_agent_job(job_id: str, github_token: str, payload: JobCreate = None, resume: bool = False):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        
        job.status = "RUNNING"
        db.commit()

        app = create_graph()
        config = {"configurable": {"thread_id": job_id, "github_token": github_token}}

        if resume:
            # Resume from checkpoint using stream
            stream = app.stream(None, config, stream_mode="values")
        else:
            # Start new job using stream
            state = IssueState(
                repo_owner=payload.repo_owner,
                repo_name=payload.repo_name,
                issue_number=payload.issue_number,
                llm_provider=payload.llm_provider,
                github_token=github_token
            )
            stream = app.stream(state, config, stream_mode="values")

        final_state = {}
        for state_update in stream:
            final_state = state_update
            # Write progress live to database on every step
            inner_db = SessionLocal()
            try:
                db_job = inner_db.query(Job).filter(Job.id == job_id).first()
                if db_job:
                    db_job.console_logs = json.dumps(state_update.get("console_logs", []))
                    db_job.current_step = state_update.get("current_step")
                    db_job.issue_title = state_update.get("issue_title")
                    db_job.problem_summary = state_update.get("problem_summary")
                    db_job.root_cause_analysis = state_update.get("root_cause_analysis")
                    db_job.pr_url = state_update.get("pr_url")
                    db_job.approved_changes = json.dumps(state_update.get("approved_changes", []))
                    inner_db.commit()
            except Exception as e:
                print(f"Error writing stream logs: {e}")
            finally:
                inner_db.close()

        # After stream finishes, check final state & next step target
        snapshot = app.get_state(config)
        
        # Refresh job row
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            if snapshot.next and "apply_file_change" in snapshot.next:
                job.status = "AWAITING_APPROVAL"
            else:
                job.status = "COMPLETED"
                
            job.current_step = final_state.get("current_step")
            job.issue_title = final_state.get("issue_title")
            job.problem_summary = final_state.get("problem_summary")
            job.root_cause_analysis = final_state.get("root_cause_analysis")
            job.pr_url = final_state.get("pr_url")
            job.approved_changes = json.dumps(final_state.get("approved_changes", []))
            job.console_logs = json.dumps(final_state.get("console_logs", []))
            db.commit()
    except Exception as e:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "FAILED"
            job.error_message = str(e)
            db.commit()
    finally:
        db.close()

def format_job_response(job: Job) -> dict:
    """Helper to convert Job SQLAlchemy model to dictionary for Pydantic response."""
    job_dict = job.__dict__.copy()
    if job.approved_changes:
        try:
            job_dict["approved_changes"] = json.loads(job.approved_changes)
        except (json.JSONDecodeError, TypeError):
            job_dict["approved_changes"] = []
    else:
        job_dict["approved_changes"] = []
    if job.console_logs:
        try:
            job_dict["console_logs"] = json.loads(job.console_logs)
        except (json.JSONDecodeError, TypeError):
            job_dict["console_logs"] = []
    else:
        job_dict["console_logs"] = []
    return job_dict

@router.post("/", response_model=JobResponse)
async def create_job(payload: JobCreate, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Initiate and launch a new agentic PR generation job.

    Performs the following lifecycle steps:
    1. **Credential Check**: Validates the current user has a linked GitHub OAuth authorization token.
    2. **Quota Check**: Enforces fixed daily (5 jobs/day) and concurrent (2 active running/pending/approval) quotas.
    3. **Job DB Registration**: Creates a SQL row mapping the target repo, issue ID, select LLM provider, and active user reference.
    4. **Background Worker Dispatch**: Initiates the LangGraph state flow asynchronously using FastAPI background tasks to prevent HTTP connection block.

    - **payload**: The target repository details (repo owner, name, target issue number, and LLM option).
    - **return**: Created job metadata status response.
    """
    if not current_user.github_token:
        raise HTTPException(status_code=400, detail="GitHub account not connected. Please connect your GitHub account first.")

    # Enforce Daily (5) and Concurrent (2) Quota limits
    from datetime import datetime
    now = datetime.utcnow()
    start_of_today = datetime(now.year, now.month, now.day)

    jobs_today_count = db.query(Job).filter(
        Job.user_id == current_user.id,
        Job.created_at >= start_of_today
    ).count()

    active_jobs_count = db.query(Job).filter(
        Job.user_id == current_user.id,
        Job.status.in_(["PENDING", "RUNNING", "AWAITING_APPROVAL"])
    ).count()

    DAILY_LIMIT = 5
    CONCURRENT_LIMIT = 2

    if active_jobs_count >= CONCURRENT_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Quota exceeded: You have {active_jobs_count} active job(s) running. (Maximum concurrent limit: {CONCURRENT_LIMIT})"
        )

    if jobs_today_count >= DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Quota exceeded: You have created {jobs_today_count} job(s) today. (Maximum daily limit: {DAILY_LIMIT})"
        )

    db_job = Job(**payload.model_dump(), user_id=current_user.id)
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    
    background_tasks.add_task(run_agent_job, db_job.id, decrypt_token(current_user.github_token), payload)
    return format_job_response(db_job)

@router.post("/{job_id}/approve", response_model=JobResponse)
async def approve_job(job_id: str, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Approve generated codebase modifications and resume execution.

    Resumes the LangGraph thread from its current checkpoint (`apply_file_change` interrupt).
    Decrypts the GitHub token and fires the background pipeline thread to apply updates to disk
    and submit the final GitHub Pull Request.

    - **job_id**: Unique UUID matching the target PR job.
    - **return**: Refreshed job response indicating execution has resumed.
    """
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != "AWAITING_APPROVAL":
        raise HTTPException(status_code=400, detail=f"Job is in status {job.status}, cannot approve.")

    background_tasks.add_task(run_agent_job, job_id, decrypt_token(current_user.github_token), resume=True)
    return format_job_response(job)

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Fetch the execution details of a specific job by ID.

    Queries the relational database for job parameters including active steps, terminal console logs,
    acceptance criteria breakdown, issue analysis, and proposed diff lists.
    Admins are permitted to access any job, while standard users are restricted to their own jobs.

    - **job_id**: Unique UUID matching the target job.
    - **return**: Formatted job details.
    """
    if current_user.role == "admin":
        job = db.query(Job).filter(Job.id == job_id).first()
    else:
        job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return format_job_response(job)

@router.get("/", response_model=List[JobResponse])
async def list_jobs(skip: int = 0, limit: int = 10, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Query historical list of jobs.

    Fetches user-owned or global (if admin) jobs. Employs offset pagination.

    - **skip**: Number of job records to skip (offset).
    - **limit**: Maximum number of job records to return.
    - **return**: List of matching jobs.
    """
    if current_user.role == "admin":
        jobs = db.query(Job).offset(skip).limit(limit).all()
    else:
        jobs = db.query(Job).filter(Job.user_id == current_user.id).offset(skip).limit(limit).all()
    
    return [format_job_response(job) for job in jobs]

@router.put("/{job_id}/changes", response_model=JobResponse)
async def update_job_changes(
    job_id: str,
    payload: ChangeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Surgically edit a specific proposed file modification before final approval.

    This endpoint permits users to edit the LLM-generated code replacements in the UI:
    1. Locates the target file path in the job's `approved_changes` list.
    2. Overwrites the `updated_content` attribute with the user's customized modifications.
    3. Saves changes back to the SQL database.
    4. Syncs the updated list with the LangGraph state checkpoints table to ensure the resumed execution picks up the user's manual adjustments.

    - **job_id**: Unique UUID matching the target job.
    - **payload**: The target file path and the updated content body.
    - **return**: Updated job response metadata.
    """
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    if not job.approved_changes:
        raise HTTPException(status_code=400, detail="No approved changes exist yet to edit.")

    try:
        changes = json.loads(job.approved_changes)
    except (json.JSONDecodeError, TypeError):
        changes = []

    # Find the target file and update it
    found = False
    for change in changes:
        if change["file_path"] == payload.file_path:
            change["updated_content"] = payload.updated_content
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail=f"File path '{payload.file_path}' not found in approved changes.")

    # Save to db
    job.approved_changes = json.dumps(changes)
    db.commit()
    db.refresh(job)

    # Sync with LangGraph checkpoint database (checkpoints.db)
    try:
        app = create_graph()
        config = {"configurable": {"thread_id": job_id}}
        app.update_state(config, {"approved_changes": changes})
    except Exception as e:
        # If checkpoint database is empty or not yet initialized for this thread, ignore
        pass

    return format_job_response(job)

# Workspace File Explorer Helper and Endpoints
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_DIR = BACKEND_DIR / "workspace" / "repos"

def ensure_workspace_cloned(job: Job, db: Session) -> Path:
    """
    Ensure the workspace directory exists on disk.
    If it is missing (due to server sleeping, restarts, or disk resets),
    it dynamically re-clones the repository and re-applies all approved
    proposed patches from Job.approved_changes.
    """
    job_dir = WORKSPACE_DIR / job.id
    repo_path = job_dir / job.repo_name

    if not job_dir.exists() or not repo_path.exists():
        # Get user
        user = db.query(User).filter(User.id == job.user_id).first()
        if not user or not user.github_token:
            return repo_path  # Cannot restore without token, return path to fail safely downstream
            
        token = decrypt_token(user.github_token)
        
        from tools.repository.clone import clone_repository
        try:
            clone_repository(
                job_id=job.id,
                owner=job.repo_owner,
                repo=job.repo_name,
                token=token
            )
            
            # Re-apply any approved modifications
            if job.approved_changes:
                changes = json.loads(job.approved_changes)
                for change in changes:
                    file_path = change.get("file_path")
                    updated_content = change.get("updated_content")
                    if file_path and updated_content:
                        target_file_path = repo_path / file_path
                        target_file_path.parent.mkdir(parents=True, exist_ok=True)
                        with open(target_file_path, "w", encoding="utf-8") as f:
                            f.write(updated_content)
        except Exception as e:
            print(f"Error self-healing/restoring workspace: {e}")
            
    return repo_path

def get_safe_workspace_path(repo_base: Path, relative_path: str) -> Path:
    """
    Resolve and validate workspace file paths.

    Prevents directory traversal security attacks (e.g., using '../../etc/passwd')
    by checking that the resolved target path resides within the job's sandboxed cloned repository.
    """
    target_path = (repo_base / relative_path).resolve()
    
    # Enforce path traversal block
    if not str(target_path).startswith(str(repo_base)):
        raise HTTPException(status_code=403, detail="Access denied: path traversal attempt detected")
        
    return target_path

@router.get("/{job_id}/workspace/tree")
async def get_workspace_tree(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    List the files and directories inside the job's cloned workspace repository.

    Reads the directory recursively. Ignores standard dependencies and meta directories (e.g. `.git`, `node_modules`, `.venv`)
    to deliver a clean tree structure for the code editor sidebar.

    - **job_id**: Unique UUID matching the target job.
    - **return**: Flat list of file and directory objects with path and directory flags.
    """
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    repo_base = ensure_workspace_cloned(job, db)
    if not repo_base.exists():
        return []
        
    file_list = []
    ignore_patterns = {".git", "node_modules", ".venv", "__pycache__", "dist", "build", ".venv-test"}
    
    for root, dirs, files in os.walk(repo_base):
        # Modify dirs in-place to avoid traversing ignored folders
        dirs[:] = [d for d in dirs if d not in ignore_patterns]
        
        for file in files:
            full_path = Path(root) / file
            rel_path = full_path.relative_to(repo_base)
            file_list.append({
                "path": str(rel_path),
                "is_dir": False
            })
            
        for d in dirs:
            full_path = Path(root) / d
            rel_path = full_path.relative_to(repo_base)
            file_list.append({
                "path": str(rel_path),
                "is_dir": True
            })
            
    file_list.sort(key=lambda x: x["path"])
    return file_list

@router.get("/{job_id}/workspace/file")
async def get_workspace_file(job_id: str, path: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Read the content of a file inside the cloned workspace repository.

    Performs safe path resolution. Rejects queries targeting binary file content
    to prevent encoding exceptions.

    - **job_id**: Unique UUID matching the target job.
    - **path**: Relative file path to query.
    - **return**: Stringified file content.
    """
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    repo_base = ensure_workspace_cloned(job, db)
    target_path = get_safe_workspace_path(repo_base, path)
    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
        
    # Check if file is binary
    try:
        with open(target_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Cannot read binary file contents.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@router.put("/{job_id}/workspace/file")
async def update_workspace_file(job_id: str, payload: ChangeUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Overwite or save updates directly to a file in the workspace repository.

    Permits raw manual file modifications on files in the workspace. Creates parent directories dynamically if necessary.
    Synchronizes the edits back to Job.approved_changes and the LangGraph thread checkpointer state
    to prevent file edits from being lost during server sleep resets.
    """
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    repo_base = ensure_workspace_cloned(job, db)
    target_path = get_safe_workspace_path(repo_base, payload.file_path)
    
    # 1. Read original content from disk before overwriting if not already tracked
    original_content = ""
    try:
        if target_path.exists() and target_path.is_file():
            with open(target_path, "r", encoding="utf-8") as f:
                original_content = f.read()
    except Exception:
        pass

    # 2. Write the new content to disk
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(payload.updated_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error writing file: {str(e)}")

    # 3. Synchronize with Job.approved_changes in the relational database
    try:
        changes = json.loads(job.approved_changes) if job.approved_changes else []
    except (json.JSONDecodeError, TypeError):
        changes = []

    # Check if this file is already tracked in proposed modifications
    found = False
    for change in changes:
        if change.get("file_path") == payload.file_path:
            change["updated_content"] = payload.updated_content
            # Keep original content if already tracked, otherwise use what we read
            if "original_content" not in change:
                change["original_content"] = original_content
            found = True
            break

    if not found:
        # Create a new modification entry
        changes.append({
            "file_path": payload.file_path,
            "objective": "Manual workspace editor patches",
            "original_content": original_content,
            "updated_content": payload.updated_content,
            "change_summary": f"Manual developer patch to {payload.file_path}"
        })

    job.approved_changes = json.dumps(changes)
    db.commit()
    db.refresh(job)

    # 4. Sync with LangGraph checkpoint database (checkpoints.db / Postgres Saver)
    try:
        app = create_graph()
        config = {"configurable": {"thread_id": job_id}}
        app.update_state(config, {"approved_changes": changes})
    except Exception as e:
        # If checkpoint database is empty or thread is not yet active, pass
        pass

    return {"status": "success"}

@router.delete("/{job_id}")
async def delete_job(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Cancel and permanently delete a job.

    Deletes the database record, frees up active concurrency quota,
    and cleans up all local repository workspace files on disk.
    """
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Clean up workspace files on disk
    job_dir = WORKSPACE_DIR / job_id
    if job_dir.exists():
        import shutil
        shutil.rmtree(job_dir, ignore_errors=True)

    # Delete database row reference
    db.delete(job)
    db.commit()

    return {"status": "success", "message": f"Job {job_id} successfully deleted."}

