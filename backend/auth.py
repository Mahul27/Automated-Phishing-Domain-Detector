"""Verify the browser's Supabase access token with Supabase Auth."""

from dataclasses import dataclass

import requests
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.config import SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL


bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentUser:
    if not credentials:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    if not SUPABASE_URL or not SUPABASE_PUBLISHABLE_KEY:
        raise HTTPException(status_code=503, detail="Supabase settings are missing.")

    try:
        response = requests.get(
            f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": SUPABASE_PUBLISHABLE_KEY,
                "Authorization": f"Bearer {credentials.credentials}",
            },
            timeout=10,
        )
    except requests.RequestException as error:
        raise HTTPException(status_code=503, detail="Supabase Auth is unavailable.") from error

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    try:
        user = response.json()
    except ValueError as error:
        raise HTTPException(status_code=503, detail="Invalid response from Supabase Auth.") from error
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=401, detail="Invalid Supabase user.")
    return CurrentUser(id=str(user["id"]), email=str(user.get("email") or "Analyst"))
