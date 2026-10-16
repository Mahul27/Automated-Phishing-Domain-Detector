import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from sqlalchemy import text

from backend.config import (
    BACKEND_ROOT,
    LIVE_SCAN_LIMIT,
)
from backend.database import (
    SessionLocal,
)
from backend.services.scan_service import (
    normalise_domain,
    scan_domain,
)


KEYWORDS_FILE = (
    BACKEND_ROOT
    / "data"
    / "brands_keywords.txt"
)
MAX_LIVE_SCAN_LIMIT = 2000
STATE_FILE = BACKEND_ROOT / "data" / "opensquat_state.json"
_REFRESH_LOCK = Lock()
logger = logging.getLogger(__name__)


def _last_fetch_at() -> str | None:
    try:
        state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        value = state.get("last_fetch_at") if isinstance(state, dict) else None
        if not isinstance(value, str):
            return None
        fetched_at = datetime.fromisoformat(value)
        if fetched_at.tzinfo is None:
            return None
        return fetched_at.astimezone(timezone.utc).isoformat()
    except (OSError, ValueError):
        return None


def _save_last_fetch_at(value: str) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=STATE_FILE.parent,
            prefix=f"{STATE_FILE.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            json.dump({"last_fetch_at": value}, temporary)
            temporary.flush()
            os.fsync(temporary.fileno())
        temporary_path.replace(STATE_FILE)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _opensquat_executable() -> str | None:
    local_executable = (
        Path(sys.executable).parent
        / "opensquat"
    )

    return (
        str(local_executable)
        if local_executable.is_file()
        and os.access(local_executable, os.X_OK)
        else shutil.which("opensquat")
    )


def opensquat_status() -> dict:
    reason = None
    if not _opensquat_executable():
        reason = "OpenSquat is not installed."
    elif not KEYWORDS_FILE.is_file():
        reason = "OpenSquat keywords file is missing."

    return {
        "status": "unavailable" if reason else "ready",
        "reason": reason,
        "refresh_running": _REFRESH_LOCK.locked(),
        "last_fetch_at": _last_fetch_at(),
    }


def fetch_opensquat_domains() -> list[str]:
    executable = _opensquat_executable()

    if not executable:
        raise RuntimeError(
            "OpenSquat is not installed."
        )

    if not KEYWORDS_FILE.is_file():
        raise RuntimeError(
            f"OpenSquat keywords file is missing: "
            f"{KEYWORDS_FILE}"
        )

    with tempfile.TemporaryDirectory(
        prefix="opensquat-"
    ) as temporary:

        output = (
            Path(temporary)
            / "results.txt"
        )

        command = [
            executable,
            "-k",
            str(KEYWORDS_FILE),
            "-o",
            str(output),
            "-t",
            "txt",
        ]

        completed = subprocess.run(
            command,
            cwd=temporary,
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )

        if (
            completed.returncode != 0
            or not output.is_file()
        ):
            message = (
                completed.stderr
                or completed.stdout
                or "unknown error"
            ).strip()

            raise RuntimeError(
                f"OpenSquat failed: "
                f"{message[-400:]}"
            )

        domains = []
        seen = set()

        for line in output.read_text(
            encoding="utf-8-sig"
        ).splitlines():

            try:
                domain = normalise_domain(
                    line
                )
            except ValueError:
                continue

            if domain not in seen:
                seen.add(domain)
                domains.append(domain)

        return domains


def _refresh_live_domains(limit: int) -> dict:

    added = 0
    attempted = 0
    failed = 0

    try:
        candidates = (
            fetch_opensquat_domains()
        )
    except subprocess.TimeoutExpired:
        logger.exception("OpenSquat feed fetch timed out")
        return {
            "status": "failed",
            "added_count": 0,
            "failed_count": 0,
            "error_code": "feed_timeout",
            "error": "The OpenSquat feed took too long to respond. Please try again later.",
        }
    except Exception:
        logger.exception("Could not fetch the OpenSquat feed")
        return {
            "status": "failed",
            "added_count": 0,
            "failed_count": 0,
            "error_code": "feed_unavailable",
            "error": "Could not fetch the OpenSquat feed. Please try again later.",
        }

    fetched_at = datetime.now(timezone.utc).isoformat()

    try:
        with SessionLocal() as db:

            existing_rows = db.execute(
                text(
                    """
                    SELECT d.domain_name
                    FROM scan_results sr
                    INNER JOIN domains d
                        ON sr.domain_id = d.domain_id
                    WHERE sr.user_id IS NULL
                    """
                )
            ).scalars().all()

            existing = set(
                existing_rows
            )
    except Exception:
        logger.exception("Could not read saved live domains before refresh")
        return {
            "status": "failed",
            "added_count": 0,
            "failed_count": 0,
            "error_code": "database_unavailable",
            "error": "Could not access saved live results. Please try again later.",
        }

    for domain in candidates:

        if (
            added >= limit
            or attempted >= max(
                20,
                limit * 5,
            )
        ):
            break

        if domain in existing:
            continue

        attempted += 1

        try:

            with SessionLocal() as db:

                scan_domain(
                    db,
                    domain,
                    "live",
                    None,
                )

            existing.add(domain)
            added += 1

        except Exception:
            failed += 1
            logger.exception("Could not scan live domain %s", domain)

    status = "success" if added or not failed else "failed"
    error = None
    if failed:
        error = (
            f"{failed} {'domain' if failed == 1 else 'domains'} could not be scanned. "
            "Please try fetching again later."
        )

    result = {
        "status": status,
        "added_count": added,
        "failed_count": failed,
        "error_code": "scan_failed" if failed else None,
        "error": error,
    }
    if status == "success":
        result["last_fetch_at"] = fetched_at
        try:
            _save_last_fetch_at(fetched_at)
        except Exception:
            logger.exception("Could not persist the last OpenSquat fetch time")
            result["warning_code"] = "fetch_time_not_saved"
            result["warning"] = (
                "Live domains were refreshed, but the last fetch time could not be saved."
            )
    return result


def refresh_live_domains(limit: int = LIVE_SCAN_LIMIT) -> dict:
    if not 1 <= limit <= MAX_LIVE_SCAN_LIMIT:
        return {
            "status": "failed",
            "added_count": 0,
            "failed_count": 0,
            "error_code": "invalid_limit",
            "error": f"Limit must be between 1 and {MAX_LIVE_SCAN_LIMIT}.",
        }

    # Serialize refreshes within this API process without blocking other requests.
    if not _REFRESH_LOCK.acquire(blocking=False):
        return {
            "status": "failed",
            "added_count": 0,
            "failed_count": 0,
            "error_code": "refresh_in_progress",
            "error": "A live feed refresh is already running. Try again once it completes.",
        }

    try:
        return _refresh_live_domains(limit)
    finally:
        _REFRESH_LOCK.release()
