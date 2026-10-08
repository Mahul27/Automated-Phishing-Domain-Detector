import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

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


def fetch_opensquat_domains() -> list[str]:

    local_executable = (
        Path(sys.executable).parent
        / "opensquat"
    )

    executable = (
        str(local_executable)
        if local_executable.is_file()
        else shutil.which("opensquat")
    )

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
            cwd=BACKEND_ROOT,
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


def refresh_live_domains(
    limit: int = LIVE_SCAN_LIMIT,
) -> dict:

    added = 0
    attempted = 0
    failures = []

    try:

        candidates = (
            fetch_opensquat_domains()
        )

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

            except Exception as error:

                failures.append(
                    f"{domain}: {error}"
                )

        status = (
            "success"
            if added or not failures
            else "failed"
        )

        message = (
            "; ".join(
                failures[:3]
            )
            or None
        )

        return {
            "status": status,
            "added_count": added,
            "error": message,
        }

    except Exception as error:

        return {
            "status": "failed",
            "added_count": 0,
            "error": str(error),
        }