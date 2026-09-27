"""API expected by the existing React dashboard."""

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.auth import CurrentUser, get_current_user
from backend.config import AUTO_SCAN_ENABLED, AUTO_SCAN_INTERVAL_HOURS
from backend.database import Scan, SessionLocal, SourceRun, get_db, init_db, utc_iso
from backend.services.dashboard_service import build_dashboard_summary
from backend.services.import_service import parse_imported_domains
from backend.services.model_service import model_status
from backend.services.opensquat_service import refresh_live_domains
from backend.services.scan_service import normalise_domain, scan_domain, scan_response


logger = logging.getLogger(__name__)


class DomainRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=512)


class ReviewRequest(BaseModel):
    decision: str
    note: str | None = Field(default=None, max_length=5000)


async def _refresh_daily():
    while True:
        with SessionLocal() as db:
            latest = db.scalars(select(SourceRun).order_by(SourceRun.id.desc()).limit(1)).first()
            last_success = latest.finished_at if latest and latest.status == "success" else None
        if last_success:
            if last_success.tzinfo is None:
                last_success = last_success.replace(tzinfo=timezone.utc)
            next_run = last_success + timedelta(hours=AUTO_SCAN_INTERVAL_HOURS)
            remaining = (next_run - datetime.now(timezone.utc)).total_seconds()
            if remaining > 0:
                await asyncio.sleep(remaining)
        try:
            logger.info("Starting scheduled OpenSquat refresh")
            result = await asyncio.to_thread(refresh_live_domains)
            if result["status"] == "failed":
                logger.warning("Scheduled OpenSquat refresh failed: %s", result["error"])
            else:
                logger.info("Scheduled OpenSquat refresh added %s domains", result["added_count"])
        except Exception:
            # An unexpected pipeline error should not stop tomorrow's refresh.
            logger.exception("Scheduled OpenSquat refresh crashed")
        await asyncio.sleep(AUTO_SCAN_INTERVAL_HOURS * 3600)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    task = asyncio.create_task(_refresh_daily()) if AUTO_SCAN_ENABLED else None
    try:
        yield
    finally:
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task


app = FastAPI(title="Threat Hunter API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):[0-9]+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Threat Hunter API is running"}


@app.get("/health")
@app.get("/api/v1/health")
def health(db: Session = Depends(get_db)):
    latest = db.scalars(select(SourceRun).order_by(SourceRun.id.desc()).limit(1)).first()
    model = model_status()
    return {
        "status": "healthy" if model["mode"] == "xgboost" else "degraded",
        "model": model,
        "opensquat": {
            "status": latest.status if latest else "waiting",
            "last_run": utc_iso(latest.finished_at) if latest else None,
            "last_added": latest.added_count if latest else 0,
            "error": latest.error if latest else None,
        },
    }


@app.post("/api/v1/scans")
def create_scan(
    request: DomainRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan = scan_domain(db, request.domain, "manual", user.id)
    return scan_response(scan)


@app.get("/api/v1/scans")
def get_scans(
    collection: str = "live",
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if collection == "live":
        query = select(Scan).where(Scan.source == "live")
    elif collection == "personal":
        query = select(Scan).where(Scan.user_id == user.id, Scan.source != "live")
    else:
        raise HTTPException(status_code=400, detail="Collection must be live or personal.")
    records = db.scalars(query.order_by(Scan.scan_time.desc(), Scan.id.desc())).all()
    return {"records": [scan_response(scan) for scan in records]}


@app.get("/api/v1/scans/{scan_id}")
def get_scan(
    scan_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan = db.get(Scan, scan_id)
    if not scan or (scan.source != "live" and scan.user_id != user.id):
        raise HTTPException(status_code=404, detail="Scan not found.")
    return scan_response(scan)


@app.patch("/api/v1/scans/{scan_id}/review")
def save_review(
    scan_id: int,
    review: ReviewRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if review.decision not in {"Confirmed Phishing", "False Positive"}:
        raise HTTPException(status_code=400, detail="Choose Confirmed Phishing or False Positive.")
    scan = db.get(Scan, scan_id)
    if not scan or (scan.source != "live" and scan.user_id != user.id):
        raise HTTPException(status_code=404, detail="Scan not found.")
    scan.review_status = "Completed"
    scan.decision = review.decision
    scan.note = review.note
    scan.reviewer = user.email
    scan.review_date = datetime.now(timezone.utc)
    db.commit()
    db.refresh(scan)
    return scan_response(scan)


@app.post("/api/v1/imports")
async def import_scans(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = await file.read(2_000_001)
    if len(data) > 2_000_000:
        raise HTTPException(status_code=413, detail="File must be 2 MB or smaller.")
    domains = parse_imported_domains(file.filename or "", data)
    accepted = 0
    errors = []
    for row_number, value in enumerate(domains, start=1):
        try:
            if not isinstance(value, str):
                raise ValueError("Domain must be text.")
            normalise_domain(value)
            scan_domain(db, value, "import", user.id)
            accepted += 1
        except (ValueError, HTTPException) as error:
            detail = error.detail if isinstance(error, HTTPException) else str(error)
            errors.append(f"Row {row_number}: {detail}")
    return {
        "filename": file.filename,
        "accepted_count": accepted,
        "rejected_count": len(errors),
        "errors": errors,
    }


@app.get("/api/v1/dashboard/summary")
def dashboard_summary(
    _user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scans = db.scalars(select(Scan).where(Scan.source == "live")).all()
    return build_dashboard_summary(scans, datetime.now(timezone.utc).date())
