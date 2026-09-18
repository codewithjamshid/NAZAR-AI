"""Password hashing, JWT issue/verify, FastAPI auth dependencies and case visibility."""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Case, User, UserRole

_ALGO = "HS256"
_PBKDF2_ITER = 200_000
_bearer = HTTPBearer(auto_error=False)


# --- passwords (stdlib PBKDF2, no extra dependency) ---------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), _PBKDF2_ITER
    ).hex()
    return f"pbkdf2_sha256${_PBKDF2_ITER}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
        calc = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(iterations)
        ).hex()
    except ValueError:
        return False
    return hmac.compare_digest(calc, digest)


# --- JWT ---------------------------------------------------------------------

def create_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "facility_id": user.facility_id,
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_expire_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGO)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"}
    )


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise _unauthorized("Token kerak")
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=[_ALGO])
    except jwt.PyJWTError:
        raise _unauthorized("Token yaroqsiz yoki muddati o'tgan")
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise _unauthorized("Foydalanuvchi topilmadi")
    return user


def require_roles(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Ruxsat yo'q")
        return user

    return dependency


# --- visibility (TZ §11: nurse sees only own facility) -----------------------

def case_visible_to(case: Case, user: User) -> bool:
    if user.role in (UserRole.SPECIALIST, UserRole.ADMIN):
        return True
    if user.role == UserRole.NURSE:
        return case.facility_id == user.facility_id
    if user.role == UserRole.OPERATOR:
        # District operator attaches CT to cases coming from FAPs in the same district (F-10).
        return (
            user.facility is not None
            and case.facility is not None
            and case.facility.district == user.facility.district
        )
    return False


def get_visible_case(db: Session, case_id: int, user: User) -> Case:
    case = db.get(Case, case_id)
    if case is None or not case_visible_to(case, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Holat topilmadi")
    return case
