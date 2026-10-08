"""Read a small CSV or JSON upload into domain strings."""

import csv
import io
import json

from fastapi import HTTPException


def parse_imported_domains(filename: str, data: bytes) -> list[object]:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(status_code=400, detail="Upload a UTF-8 CSV or JSON file.") from error

    if filename.lower().endswith(".json"):
        try:
            items = json.loads(text)
        except json.JSONDecodeError as error:
            raise HTTPException(status_code=400, detail="Invalid JSON file.") from error
        if not isinstance(items, list):
            raise HTTPException(status_code=400, detail="JSON must contain a list of domains.")
        domains = [item.get("domain", "") if isinstance(item, dict) else item for item in items]
    elif filename.lower().endswith(".csv"):
        rows = list(csv.reader(io.StringIO(text)))
        if not rows:
            return []
        header = [column.strip().lower() for column in rows[0]]
        index = header.index("domain") if "domain" in header else 0
        start = 1 if "domain" in header else 0
        domains = [row[index] if len(row) > index else "" for row in rows[start:]]
    else:
        raise HTTPException(status_code=400, detail="Only CSV and JSON files are supported.")

    if len(domains) > 100:
        raise HTTPException(status_code=400, detail="Upload at most 100 domains at a time.")
    return domains
