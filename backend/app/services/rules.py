"""Loader for rules/triage.yaml (TZ §8). The file is owned by the neurosurgeon.

The rules are re-read when the file changes on disk, so the clinical lead can
edit thresholds while the stack is running.
"""

import threading
from pathlib import Path

import yaml

from app.config import settings

REQUIRED_KEYS = (
    "version", "befast", "stroke_window", "ct_head", "cxr", "labs", "zones", "routing",
)


class RulesError(ValueError):
    """rules/triage.yaml is missing or malformed."""


_lock = threading.Lock()
_cache: dict[Path, tuple[float, dict]] = {}


def load_rules(path: Path | str | None = None) -> dict:
    rules_path = Path(path) if path is not None else settings.rules_path
    try:
        mtime = rules_path.stat().st_mtime
    except OSError as exc:
        raise RulesError(f"Qoidalar fayli topilmadi: {rules_path}") from exc

    with _lock:
        cached = _cache.get(rules_path)
        if cached and cached[0] == mtime:
            return cached[1]

    try:
        data = yaml.safe_load(rules_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise RulesError(f"Qoidalar fayli o'qilmadi: {exc}") from exc
    if not isinstance(data, dict):
        raise RulesError("Qoidalar fayli lug'at (mapping) bo'lishi kerak")
    missing = [key for key in REQUIRED_KEYS if key not in data]
    if missing:
        raise RulesError(f"Qoidalar faylida bo'lim yetishmaydi: {', '.join(missing)}")

    validate_signals(data)
    with _lock:
        _cache[rules_path] = (mtime, data)
    return data


def validate_signals(rules: dict) -> None:
    """Catch typos in the YAML: every signal named there must exist in the engine."""
    from app.services.triage import KNOWN_SIGNALS

    named = set()
    for zone_signals in rules["zones"].values():
        named.update(zone_signals or [])
    for rule in rules["routing"]:
        named.update((rule.get("when") or {}).get("any_signal", []))
    unknown = sorted(named - KNOWN_SIGNALS)
    if unknown:
        raise RulesError(f"Qoidalar faylida noma'lum signal: {', '.join(unknown)}")
