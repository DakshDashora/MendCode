import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
from api.dbconfig import get_db
from api.models import User
from api.schemas import UserCreate, UserResponse, Token
from api.auth_utils import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    get_current_user,
    get_current_admin,
    encrypt_token
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI")

@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user_data.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user_data.password)
    new_user = User(username=user_data.username, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"id": user.id, "sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role,
        "github_token": "CONNECTED" if current_user.github_token else None,
        "created_at": current_user.created_at
    }

@router.get("/users", response_model=List[UserResponse])
def list_users(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Admin only: List all users in the system."""
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "github_token": "CONNECTED" if u.github_token else None,
            "created_at": u.created_at
        }
        for u in users
    ]


@router.get("/github/login")
def github_login():
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub Client ID not configured")
    
    url = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=repo,user"
    if GITHUB_REDIRECT_URI:
        url += f"&redirect_uri={GITHUB_REDIRECT_URI}"
        
    return {
        "url": url
    }

@router.get("/github/callback")
async def github_callback(code: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "client_secret": GITHUB_CLIENT_SECRET,
        "code": code,
    }
    if GITHUB_REDIRECT_URI:
        params["redirect_uri"] = GITHUB_REDIRECT_URI

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            params=params,
            headers={"Accept": "application/json"},
        )
        data = response.json()
        
    if "access_token" not in data:
        raise HTTPException(status_code=400, detail=f"Failed to get GitHub token: {data}")

    github_token = data["access_token"]
    current_user.github_token = encrypt_token(github_token)
    db.commit()
    
    return {"message": "GitHub account connected successfully"}

@router.post("/github/disconnect")
def github_disconnect(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.github_token = None
    db.commit()
    return {"message": "GitHub account disconnected successfully"}

