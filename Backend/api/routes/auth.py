import os
import httpx
import random
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from typing import List
from api.dbconfig import get_db
from api.models import User
from api.schemas import (
    UserCreate, UserResponse, Token, VerifyOtpRequest, 
    GoogleLoginRequest, UsernameCheckResponse, UpdateUsernameRequest
)
from api.utils.auth import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    get_current_user,
    get_current_admin,
    encrypt_token
)
from api.utils.mailer import send_otp_email

router = APIRouter(prefix="/auth", tags=["Authentication"])

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI")

@router.post("/register", response_model=UserResponse)
def register(user_data: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Register a new user account with MendCode.

    This endpoint performs the following operations:
    1. **Duplicate Check**: Checks if the target email is already registered and verified.
    2. **Temporary User Resend**: If the email is registered but unverified, it resets the verification OTP code and sends a new registration email.
    3. **Username Generation**: Automatically derives a unique username prefix from the email.
    4. **Background Task dispatch**: Offloads sending of the 6-digit OTP verification email to background workers using FastAPI BackgroundTasks.

    - **user_data**: Pydantic schema containing user email and password requirements.
    - **return**: Created user response schema with verification pending status.
    """
    # 1. Check if email already registered
    db_user_email = db.query(User).filter(User.email == user_data.email).first()
    if db_user_email:
        if db_user_email.is_verified:
            raise HTTPException(status_code=400, detail="Email is already registered and verified")
        else:
            # Re-generate OTP for existing unverified user to prevent unique constraints issues
            otp = f"{random.randint(100000, 999999)}"
            db_user_email.verification_otp = otp
            db_user_email.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
            db_user_email.hashed_password = get_password_hash(user_data.password)
            db.commit()
            background_tasks.add_task(send_otp_email, db_user_email.email, otp)
            return db_user_email

    # 2. Derive username prefix from email
    email_prefix = user_data.email.split("@")[0]
    # Ensure username prefix is unique in the database
    suffix = 1
    base_username = email_prefix
    while db.query(User).filter(User.username == base_username).first() is not None:
        base_username = f"{email_prefix}{suffix}"
        suffix += 1

    # 3. Generate OTP
    otp = f"{random.randint(100000, 999999)}"
    hashed_password = get_password_hash(user_data.password)

    new_user = User(
        username=base_username,
        email=user_data.email,
        hashed_password=hashed_password,
        is_verified=False,
        verification_otp=otp,
        otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    background_tasks.add_task(send_otp_email, new_user.email, otp)
    return new_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Authenticate via Username/Email and Password.

    This standard OAuth2 password flow endpoint:
    1. Authenticates users by matching either their raw **username** or their registered **email address**.
    2. Verifies the password using CryptContext bcrypt hashing.
    3. Restricts logins for unverified users who have not completed OTP flow.
    4. Generates a sign-in access JWT token containing `id`, `sub` (username), and authorization `role`.

    - **form_data**: Standard Form parameters containing username (or email) and password.
    - **return**: Bearer Access token payload.
    """
    # Lookup by username OR email
    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User email is not verified. Please verify your OTP first.",
        )
    
    access_token = create_access_token(data={"id": user.id, "sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/verify-otp", response_model=Token)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    """
    Verify registration OTP code.

    This endpoint:
    1. Validates the 6-digit OTP code against the database.
    2. Checks OTP expiration (codes are valid for 10 minutes).
    3. Activates the user account (`is_verified = True`) and clears OTP state fields.
    4. Returns a logged-in Bearer JWT access token.

    - **payload**: Schema containing user email and the 6-digit verification code.
    - **return**: Bearer Access token payload.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email not found")
    
    if user.is_verified:
        # Already verified, log them in
        access_token = create_access_token(data={"id": user.id, "sub": user.username, "role": user.role})
        return {"access_token": access_token, "token_type": "bearer"}

    if user.verification_otp != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Check expiry
    now = datetime.now(timezone.utc)
    expires_at = user.otp_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if now > expires_at:
        raise HTTPException(status_code=400, detail="Verification code has expired")

    user.is_verified = True
    user.verification_otp = None
    user.otp_expires_at = None
    db.commit()

    access_token = create_access_token(data={"id": user.id, "sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/google", response_model=Token)
async def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate/Sign Up via Google OAuth Credentials.

    This endpoint verifies the ID token with Google's OAuth2 token info service.
    If the Google account email is registered, the user is authenticated and active.
    If the email is new, a unique username prefix is derived, a random secure password is set,
    and a verified user account is created on-the-fly.

    - **payload**: The Google credential ID Token received from Google Sign-In.
    - **return**: Bearer Access token payload.
    """
    async with httpx.AsyncClient() as client:
        res = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.credential}")
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Google credentials")
        
        info = res.json()
        
    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email address")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Derive unique username
        email_prefix = email.split("@")[0]
        suffix = 1
        base_username = email_prefix
        while db.query(User).filter(User.username == base_username).first() is not None:
            base_username = f"{email_prefix}{suffix}"
            suffix += 1

        random_pass = secrets.token_hex(16)
        hashed_password = get_password_hash(random_pass)
        
        user = User(
            username=base_username,
            email=email,
            hashed_password=hashed_password,
            is_verified=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.is_verified:
            user.is_verified = True
            db.commit()

    access_token = create_access_token(data={"id": user.id, "sub": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/check-username", response_model=UsernameCheckResponse)
def check_username(username: str, db: Session = Depends(get_db)):
    """
    Check username availability dynamically.

    Queries the database case-insensitively using SQLAlchemy `ilike` to verify if
    the target username is already claimed by another user. Useful for live front-end input validation.

    - **username**: Target username string to check.
    - **return**: Availability status as boolean in `UsernameCheckResponse`.
    """
    user = db.query(User).filter(User.username.ilike(username)).first()
    return {"available": user is None}

@router.put("/username")
def update_username(
    payload: UpdateUsernameRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """
    Rename current authenticated user's username.

    Validates that:
    1. The target username is not empty.
    2. The target username is not already taken by another user.
    Once verified, updates the user username column in the relational database.

    - **payload**: The target username payload.
    - **current_user**: Authed User dependency.
    - **return**: Confirmation message.
    """
    new_username = payload.username.strip()
    if not new_username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
        
    if new_username.lower() == current_user.username.lower():
        return {"message": "Username unchanged"}

    exists = db.query(User).filter(User.username.ilike(new_username)).first()
    if exists:
        raise HTTPException(status_code=400, detail="Username is already taken")

    current_user.username = new_username
    db.commit()
    return {"message": "Username updated successfully", "username": new_username}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get profile information of the current logged-in user.

    Returns primary attributes of the user profile including username, email, role,
    registration timestamp, and a redacted indicator showing if a GitHub integration token is linked.

    - **current_user**: Authenticated User.
    - **return**: User profile attributes matching UserResponse schema.
    """
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "github_token": "CONNECTED" if current_user.github_token else None,
        "is_verified": current_user.is_verified,
        "created_at": current_user.created_at
    }

@router.get("/users", response_model=List[UserResponse])
def list_users(current_user: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    """
    List all user accounts in the database (Admin Only).

    Queries and returns profile details of all registered users. Access is protected by the `get_current_admin` dependency which ensures the current authenticated user's role equals 'admin'.

    - **current_user**: Authenticated Admin User.
    - **return**: List of user profiles.
    """
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "github_token": "CONNECTED" if u.github_token else None,
            "is_verified": u.is_verified,
            "created_at": u.created_at
        }
        for u in users
    ]


@router.get("/github/login")
def github_login():
    """
    Generate GitHub OAuth authorization redirect URL.

    Constructs and returns the GitHub OAuth URL with requested scopes ('repo', 'user') 
    and configurations to initiate authentication from the frontend client.

    - **return**: OAuth redirect URL.
    """
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
    """
    Handle GitHub OAuth callback parameter and link access token.

    Exchanges the temporary `code` for an OAuth Access Token from GitHub's servers,
    encrypts the token using Fernet symmetric encryption, and persists it on the authenticated user model.

    - **code**: Temporary authentication code returned from GitHub OAuth.
    - **current_user**: Authed User context.
    - **return**: Connection success message.
    """
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
    """
    Disconnect GitHub account integration.

    Clears the encrypted `github_token` field from the database for the active user. 
    This revokes the backend agent's authority to act on behalf of the user's GitHub account.

    - **current_user**: Authenticated User.
    - **return**: Disconnection success message.
    """
    current_user.github_token = None
    db.commit()
    return {"message": "GitHub account disconnected successfully"}

