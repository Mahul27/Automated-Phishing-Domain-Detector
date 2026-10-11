
"""Parse CSV and JSON files containing domain or URL records."""

import csv
import io
import json
from fastapi import HTTPException


MAX_IMPORT_RECORDS = 1000


def parse_imported_domains(filename: str, data: bytes) -> list[str]:
    try:
        content = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Upload a UTF-8 CSV or JSON file.",
        ) from exc

    filename = (filename or "").lower()

    try:
        if filename.endswith(".json"):
            items = json.loads(content)

            if not isinstance(items, list):
                raise HTTPException(
                    status_code=400,
                    detail="JSON must be an array of objects containing a url or domain property.",
                )

            values = []
            for item in items:
                if isinstance(item, dict):
                    value = item.get("url", item.get("domain", ""))
                elif isinstance(item, str):
                    value = item
                else:
                    value = ""

                values.append(value)

        elif filename.endswith(".csv"):
            rows = list(csv.reader(io.StringIO(content)))

            if not rows:
                return []

            header = [column.strip().lower() for column in rows[0]]

            if "url" in header:
                index = header.index("url")
                start = 1
            elif "domain" in header:
                index = header.index("domain")
                start = 1
            else:
                # Support a plain one-value-per-line CSV without a header.
                index = 0
                start = 0

            values = [
                row[index].strip()
                for row in rows[start:]
                if len(row) > index and row[index].strip()
            ]

        else:
            raise HTTPException(
                status_code=400,
                detail="Only CSV and JSON files are supported.",
            )

    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid JSON file.",
        ) from exc

    if len(values) > MAX_IMPORT_RECORDS:
        raise HTTPException(
            status_code=400,
            detail=f"A maximum of {MAX_IMPORT_RECORDS} records can be imported at once.",
        )

    cleaned = []
    for value in values:
        if not isinstance(value, str):
            cleaned.append("")
        else:
            cleaned.append(value.strip())

    return cleaned
