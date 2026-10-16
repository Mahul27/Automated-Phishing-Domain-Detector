
from datetime import datetime
import logging

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db, init_db
from backend.config import LIVE_SCAN_LIMIT
from backend.auth import CurrentUser, get_current_user
from backend.services.dashboard_service import build_dashboard_summary
from backend.services.model_service import model_status
from backend.services.opensquat_service import (
    MAX_LIVE_SCAN_LIMIT,
    opensquat_status,
    refresh_live_domains,
)
from backend.services.scan_service import (
    normalise_domain,
    scan_domain,
    scan_response,
)
from backend.services.import_service import parse_imported_domains


app = FastAPI(title="Threat Hunter API", version="1.0.0")
logger = logging.getLogger(__name__)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):[0-9]+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# SUPABASE USER TO MYSQL USER MAPPING
# ============================================================

def get_mysql_user_id(db: Session, current_user: CurrentUser) -> int:
    result = db.execute(
        text("""
            SELECT user_id
            FROM app_users
            WHERE supabase_user_id = :supabase_id
        """),
        {"supabase_id": current_user.id},
    ).first()

    if result:
        return int(result[0])

    try:
        db.execute(
            text("""
                INSERT INTO app_users (supabase_user_id)
                VALUES (:supabase_id)
            """),
            {"supabase_id": current_user.id},
        )
        db.commit()
    except Exception:
        db.rollback()

        result = db.execute(
            text("""
                SELECT user_id
                FROM app_users
                WHERE supabase_user_id = :supabase_id
            """),
            {"supabase_id": current_user.id},
        ).first()

        if not result:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Your Supabase account is not mapped to a MySQL user. "
                    "Contact the project administrator."
                ),
            )

        return int(result[0])

    result = db.execute(
        text("""
            SELECT user_id
            FROM app_users
            WHERE supabase_user_id = :supabase_id
        """),
        {"supabase_id": current_user.id},
    ).first()

    if not result:
        raise HTTPException(
            status_code=500,
            detail="Could not map your account to MySQL.",
        )

    return int(result[0])


# ============================================================
# REQUEST MODELS
# ============================================================

class DomainRequest(BaseModel):
    domain: str


class ReviewRequest(BaseModel):
    decision: str
    note: str | None = None


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    init_db()


# ============================================================
# ROOT AND HEALTH
# ============================================================

@app.get("/")
def root():
    return {"message": "Threat Hunter API is running"}


@app.get("/health")
@app.get("/api/v1/health")
def health():
    return {
        "status": "healthy",
        "model": model_status(),
        "opensquat": opensquat_status(),
    }


# ============================================================
# MANUAL SCAN
# ============================================================

@app.post("/api/v1/scans")
def create_scan(
    request: DomainRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    try:
        mysql_user_id = get_mysql_user_id(db, current_user)

        scan = scan_domain(
            db,
            request.domain,
            "manual",
            mysql_user_id,
        )

        return scan_response(scan, "personal")

    except HTTPException:
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Scan failed: {error}",
        )


# ============================================================
# QUERY SCANS
# ============================================================

def _rows(
    db: Session,
    collection: str,
    mysql_user_id: int | None = None,
):
    if collection == "live":
        user_filter = "sr.user_id IS NULL"
        params = {}
    elif collection == "personal":
        if mysql_user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Sign in to view personal scans.",
            )
        user_filter = "sr.user_id = :mysql_user_id"
        params = {"mysql_user_id": mysql_user_id}
    else:
        raise HTTPException(
            status_code=400,
            detail="Collection must be live or personal.",
        )

    query = text(f"""
        SELECT
            sr.scan_id,
            sr.user_id,
            sr.domain_id,
            sr.scan_time,
            sr.prediction_result,
            sr.risk_score,
            sr.review_status,
            sr.analyst_decision,
            sr.analyst_note,
            sr.reviewed_at,
            d.domain_name,
            df.domain_age,
            df.registration_period,
            df.domain_length,
            df.hyphen_count,
            df.digit_count,
            df.shannon_entropy,
            df.brand_keyword_detection,
            df.typosquatting_similarity,
            df.ssl_certificate_age,
            df.tld
        FROM scan_results sr
        INNER JOIN domains d
            ON sr.domain_id = d.domain_id
        LEFT JOIN domain_features df
            ON sr.scan_id = df.scan_id
        WHERE {user_filter}
        ORDER BY sr.scan_time DESC
    """)

    return db.execute(query, params).mappings().all()


@app.get("/api/v1/scans")
def get_scans(
    collection: str = "live",
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    mysql_user_id = (
        get_mysql_user_id(db, current_user)
        if collection == "personal"
        else None
    )

    rows = _rows(db, collection, mysql_user_id)
    records = []

    for row in rows:
        domain = row["domain_name"] or ""
        tld = row["tld"]

        if not tld and "." in domain:
            tld = "." + domain.rsplit(".", 1)[1]

        records.append({
            "id": row["scan_id"],
            "domain": domain,
            "risk_score": float(row["risk_score"] or 0),
            "prediction": row["prediction_result"] or "Legitimate",
            "review_status": row["review_status"] or "Pending",
            "decision": row["analyst_decision"],
            "note": row["analyst_note"],
            "review_date": (
                row["reviewed_at"].isoformat()
                if row["reviewed_at"]
                else None
            ),
            "scan_time": (
                row["scan_time"].isoformat()
                if row["scan_time"]
                else None
            ),
            "tld": tld,
            "source": "manual" if collection == "personal" else "live",
            "original": domain,
        })

    return {"records": records}


# ============================================================
# GET SINGLE SCAN
# ============================================================

@app.get("/api/v1/scans/{scan_id}")
def get_scan(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    query = text("""
        SELECT
            sr.scan_id,
            sr.user_id,
            sr.domain_id,
            sr.scan_time,
            sr.prediction_result,
            sr.risk_score,
            sr.review_status,
            sr.analyst_decision,
            sr.analyst_note,
            sr.reviewed_at,
            d.domain_name,
            df.domain_age,
            df.registration_period,
            df.domain_length,
            df.hyphen_count,
            df.digit_count,
            df.shannon_entropy,
            df.brand_keyword_detection,
            df.typosquatting_similarity,
            df.ssl_certificate_age,
            df.tld,
            mo.model_name,
            mo.confidence_score,
            mo.explanation
        FROM scan_results sr
        INNER JOIN domains d
            ON sr.domain_id = d.domain_id
        LEFT JOIN domain_features df
            ON sr.scan_id = df.scan_id
        LEFT JOIN model_outputs mo
            ON sr.scan_id = mo.scan_id
        WHERE sr.scan_id = :scan_id
        ORDER BY mo.output_id DESC
        LIMIT 1
    """)

    row = db.execute(
        query,
        {"scan_id": scan_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail="Scan not found.")

    mysql_user_id = get_mysql_user_id(db, current_user)

    if (
        row["user_id"] is not None
        and int(row["user_id"]) != mysql_user_id
    ):
        raise HTTPException(status_code=404, detail="Scan not found.")

    # Review fields come from MySQL, not an in-memory dictionary.
    result = {
        "id": row["scan_id"],
        "domain": row["domain_name"],
        "risk_score": float(row["risk_score"] or 0),
        "prediction": row["prediction_result"],
        "review_status": row["review_status"] or "Pending",
        "decision": row["analyst_decision"],
        "note": row["analyst_note"],
        "review_date": (
            row["reviewed_at"].isoformat()
            if row["reviewed_at"]
            else None
        ),
        "scan_time": (
            row["scan_time"].isoformat()
            if row["scan_time"]
            else None
        ),
        "source": "manual" if row["user_id"] is not None else "live",
        "original": row["domain_name"],
        "domain_age": row["domain_age"],
        "registration_period": row["registration_period"],
        "domain_length": row["domain_length"],
        "hyphens": row["hyphen_count"],
        "digits": row["digit_count"],
        "shannon_entropy": row["shannon_entropy"],
        "brand_keyword": row["brand_keyword_detection"],
        "typosquatting_similarity": row["typosquatting_similarity"],
        "ssl_cert_age": row["ssl_certificate_age"],
        "tld": row["tld"],
        "model_name": row["model_name"] or "XGBoost",
        "confidence_score": (
            float(row["confidence_score"])
            if row["confidence_score"] is not None
            else float(row["risk_score"] or 0) / 100
        ),
        "explanation": row["explanation"],
    }

    return result


# ============================================================
# SAVE REVIEW TO MYSQL
# ============================================================

@app.patch("/api/v1/scans/{scan_id}/review")
def save_review(
    scan_id: int,
    review: ReviewRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    if review.decision not in {
        "Confirmed Phishing",
        "False Positive",
    }:
        raise HTTPException(
            status_code=400,
            detail="Choose Confirmed Phishing or False Positive.",
        )

    mysql_user_id = get_mysql_user_id(db, current_user)

    try:
        result = db.execute(
            text("""
                UPDATE scan_results
                SET review_status = 'Completed',
                    analyst_decision = :decision,
                    analyst_note = :note,
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE scan_id = :scan_id
                  AND (user_id = :user_id OR user_id IS NULL)
            """),
            {
                "decision": review.decision,
                "note": review.note,
                "scan_id": scan_id,
                "user_id": mysql_user_id,
            },
        )

        if result.rowcount == 0:
            db.rollback()
            raise HTTPException(
                status_code=404,
                detail="Scan not found or not available for review.",
            )

        db.commit()

        return {
            "id": scan_id,
            "review_status": "Completed",
            "decision": review.decision,
            "note": review.note,
        }

    except HTTPException:
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Could not save review: {error}",
        )


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

@app.get("/api/v1/dashboard/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    rows = _rows(db, "live")

    summary = build_dashboard_summary(
        rows,
        datetime.now().date(),
    )

    summary["pending_review"] = sum(
        1
        for row in rows
        if (row["review_status"] or "Pending") == "Pending"
    )

    summary["reviewed"] = sum(
        1
        for row in rows
        if (row["review_status"] or "Pending") == "Completed"
    )

    return summary


# ============================================================
# CSV / JSON IMPORT
# ============================================================

@app.post("/api/v1/imports")
async def import_scans(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    mysql_user_id = get_mysql_user_id(db, current_user)

    data = await file.read(2_000_001)

    if len(data) > 2_000_000:
        raise HTTPException(
            status_code=413,
            detail="File must be 2 MB or smaller.",
        )

    try:
        domains = parse_imported_domains(
            file.filename or "",
            data,
        )
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not parse file: {error}",
        )

    accepted = 0
    errors = []

    for row_number, value in enumerate(domains, start=1):
        try:
            if not isinstance(value, str):
                raise ValueError("Domain must be text.")

            normalise_domain(value)

            scan_domain(
                db,
                value,
                "import",
                mysql_user_id,
            )

            accepted += 1

        except Exception as error:
            db.rollback()
            errors.append(f"Row {row_number}: {error}")

    return {
        "filename": file.filename,
        "accepted_count": accepted,
        "rejected_count": len(errors),
        "errors": errors,
    }


# ============================================================
# OPEN-SQUAT REFRESH
# ============================================================

@app.post("/api/v1/opensquat/refresh")
def refresh_opensquat(
    limit: int = Query(default=LIVE_SCAN_LIMIT, ge=1, le=MAX_LIVE_SCAN_LIMIT),
):
    try:
        return refresh_live_domains(limit)
    except Exception:
        logger.exception("Unexpected OpenSquat refresh failure")
        raise HTTPException(
            status_code=500,
            detail="Could not refresh the OpenSquat feed. Please try again later.",
        )
