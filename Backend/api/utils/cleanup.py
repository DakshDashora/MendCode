import shutil
import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy.orm import Session

from api.dbconfig import SessionLocal
from api.models import Job, User
from api.utils.mailer import send_warning_email

logger = logging.getLogger("mendcode.cleanup")

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
WORKSPACE_DIR = BACKEND_DIR / "workspace" / "repos"

def run_workspace_cleanup_task():
    """
    Query database and clean up expired or inactive workspace repository directories.

    Performs the following cleanups:
    1. **PR Complete/Failed deletion**: Deletes repository clones 2 days after job finishes (status is COMPLETED or FAILED).
    2. **Active job inactivity warnings (30 days)**: Sends warning notifications to users for inactive workspace clones.
    3. **Active job inactivity deletion (40 days)**: Deletes repository clones 10 days after warning notification is sent.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # Query all jobs to process status and timestamps
        jobs = db.query(Job).all()
        for job in jobs:
            job_dir = WORKSPACE_DIR / job.id
            if not job_dir.exists():
                continue
                
            # Parse localized updated_at timestamps safely
            updated_at = job.updated_at
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
                
            # 1. PR Completed or Failed clones deletion (2 days after finish)
            if job.status in ("COMPLETED", "FAILED"):
                if now > (updated_at + timedelta(days=2)):
                    logger.info(f"Deleting completed/failed workspace clone for Job {job.id} (Status: {job.status})")
                    shutil.rmtree(job_dir, ignore_errors=True)
                    
            # 2. Inactivity checks for AWAITING_APPROVAL jobs
            elif job.status == "AWAITING_APPROVAL":
                user = db.query(User).filter(User.id == job.user_id).first()
                if not user or not user.email:
                    continue
                    
                # A. Send warning notification if inactive for 30 days
                if not job.delete_warning_sent:
                    if now > (updated_at + timedelta(days=30)):
                        logger.warning(f"Workspace for Job {job.id} inactive for 30 days. Dispatching deletion warning email.")
                        if send_warning_email(user.email, job.repo_name, days_left=10):
                            job.delete_warning_sent = True
                            job.warning_sent_at = datetime.utcnow()
                            db.commit()
                            
                # B. Execute deletion 10 days after warning sent (40 days total inactivity)
                else:
                    warning_sent_at = job.warning_sent_at
                    if warning_sent_at.tzinfo is None:
                        warning_sent_at = warning_sent_at.replace(tzinfo=timezone.utc)
                        
                    if now > (warning_sent_at + timedelta(days=10)):
                        logger.warning(f"Inactivity warning limit exceeded (10 days). Deleting workspace clone for Job {job.id}")
                        shutil.rmtree(job_dir, ignore_errors=True)
                        
    except Exception as e:
        logger.error(f"Error executing workspace cleanup scheduler task: {e}")
    finally:
        db.close()

def start_cleanup_scheduler(interval_seconds: int = 3600):
    """
    Start the background cleanup runner daemon thread.
    Checks directory records every `interval_seconds` (default: 1 hour).
    """
    def loop():
        # Delay startup check briefly to allow DB connections to settle
        time.sleep(10)
        while True:
            try:
                run_workspace_cleanup_task()
            except Exception as e:
                logger.error(f"Error in background scheduler loop: {e}")
            time.sleep(interval_seconds)
            
    thread = threading.Thread(target=loop, daemon=True, name="MendCodeCleanupScheduler")
    thread.start()
    logger.info("MendCode background workspace cleanup scheduler thread initiated successfully.")
