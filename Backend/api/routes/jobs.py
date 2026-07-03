from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import json

from api.dbconfig import get_db, SessionLocal
from api.models import Job, User
from api.schemas import JobCreate, JobResponse
from api.auth_utils import get_current_user, decrypt_token
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
        # Use job_id as the thread_id to maintain state across requests
        config = {"configurable": {"thread_id": job_id, "github_token": github_token}}

        if resume:
            # Resume from checkpoint
            app.invoke(None, config)
        else:
            # Start new job
            state = IssueState(
                repo_owner=payload.repo_owner,
                repo_name=payload.repo_name,
                issue_number=payload.issue_number,
                llm_provider=payload.llm_provider,
                github_token=github_token
            )
            app.invoke(state, config)

        # After invoke, check the current state of the graph
        snapshot = app.get_state(config)
        final_state = snapshot.values

        # Refresh job instance
        job = db.query(Job).filter(Job.id == job_id).first()
        
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
