from typing import Optional, Literal, Dict, Any
from datetime import datetime, timedelta
from fastapi import Request, Header, HTTPException, Depends
import jwt
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from .config import settings

Plan = Literal["free", "pro", "enterprise"]

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def require_api_key(req: Request):
    if req.headers.get("X-API-KEY") != settings.API_KEY:
        raise HTTPException(401, "Missing/invalid API key")

def hash_password(plain: str) -> str:
    """Hash a plain text password using bcrypt."""
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain text password against its hash."""
    return pwd_context.verify(plain, hashed)

def create_access_token(payload: Dict[str, Any], expires_minutes: int) -> str:
    """Create a JWT access token with the given payload and expiration."""
    to_encode = payload.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify a JWT access token."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload
    except InvalidTokenError:
        return None

def get_auth_user(request: Request) -> Optional[Dict[str, Any]]:
    """Get authenticated user from JWT token in Authorization header or cookie."""
    # Try Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_access_token(token)
        if payload:
            return {
                "id": payload.get("sub"),
                "email": payload.get("email"),
                "plan": payload.get("plan", "free")
            }
    
    # Try cookie
    token = request.cookies.get("airsense_access")
    if token:
        payload = decode_access_token(token)
        if payload:
            return {
                "id": payload.get("sub"),
                "email": payload.get("email"),
                "plan": payload.get("plan", "free")
            }
    
    return None

def get_plan(request: Request, x_plan: Optional[str] = Header(None)) -> Plan:
    """Get plan from authenticated user or fall back to header/env."""
    # Check if user is authenticated
    user = get_auth_user(request)
    if user and user.get("plan"):
        plan = user["plan"].strip().lower()
        if plan in {"free", "pro", "enterprise"}:
            return plan  # type: ignore
    
    # Fall back to header or default
    plan = (x_plan or settings.DEFAULT_PLAN).strip().lower()
    if plan not in {"free", "pro", "enterprise"}:
        plan = "free"
    return plan  # type: ignore
