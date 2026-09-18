"""audit_log writer. Caller owns the transaction."""

from sqlalchemy.orm import Session

from app.models import AuditLog


def record(
    db: Session,
    *,
    action: str,
    user_id: int | None = None,
    case_id: int | None = None,
    payload: dict | None = None,
) -> AuditLog:
    entry = AuditLog(user_id=user_id, case_id=case_id, action=action, payload_json=payload)
    db.add(entry)
    return entry
