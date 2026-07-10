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
    if not current_user.github_token:
        raise HTTPException(status_code=400, detail="GitHub account not connected. Please connect your GitHub account first.")

    db_job = Job(**payload.model_dump(), user_id=current_user.id)
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    
    background_tasks.add_task(run_agent_job, db_job.id, decrypt_token(current_user.github_token), payload)
    return format_job_response(db_job)

@router.post("/{job_id}/approve", response_model=JobResponse)
async def approve_job(job_id: str, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != "AWAITING_APPROVAL":
        raise HTTPException(status_code=400, detail=f"Job is in status {job.status}, cannot approve.")

    background_tasks.add_task(run_agent_job, job_id, decrypt_token(current_user.github_token), resume=True)
    return format_job_response(job)

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "admin":
        job = db.query(Job).filter(Job.id == job_id).first()
    else:
        job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return format_job_response(job)

@router.get("/", response_model=List[JobResponse])
async def list_jobs(skip: int = 0, limit: int = 10, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
def get_safe_workspace_path(job_id: str, relative_path: str) -> Path:
    # Isolate workspace per job
    job_dir = Path("workspace/repos") / job_id
    if not job_dir.exists():
        raise HTTPException(status_code=404, detail="Workspace directory not found")
    
    # Find the repository subfolder (there should be exactly one folder cloned under job_id)
    subdirs = [d for d in job_dir.iterdir() if d.is_dir() and d.name != ".git"]
    if not subdirs:
        raise HTTPException(status_code=404, detail="Workspace repository not found")
        
    repo_base = subdirs[0].resolve()
    target_path = (repo_base / relative_path).resolve()
    
    # Enforce path traversal block
    if not str(target_path).startswith(str(repo_base)):
        raise HTTPException(status_code=403, detail="Access denied: path traversal attempt detected")
        
    return target_path

@router.get("/{job_id}/workspace/tree")
async def get_workspace_tree(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    job_dir = Path("workspace/repos") / job_id
    if not job_dir.exists():
        return []
        
    subdirs = [d for d in job_dir.iterdir() if d.is_dir() and d.name != ".git"]
    if not subdirs:
        return []
        
    repo_base = subdirs[0].resolve()
    
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
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    target_path = get_safe_workspace_path(job_id, path)
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
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    target_path = get_safe_workspace_path(job_id, payload.file_path)
    try:
        # Create parent directories if they don't exist
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(payload.updated_content)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error writing file: {str(e)}")

