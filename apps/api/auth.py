from typing import Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import admin_supabase, get_user_scoped_client

security = HTTPBearer(auto_error=False)


def get_access_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    return credentials.credentials


def get_current_user(token: str = Depends(get_access_token)) -> Any:
    try:
        response = admin_supabase.auth.get_user(token)
        user = getattr(response, "user", None)
        if not user:
            raise ValueError("Invalid user response")
        return user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


def get_db(token: str = Depends(get_access_token)):
    return get_user_scoped_client(token)
