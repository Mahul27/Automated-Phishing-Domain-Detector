from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db, init_db
from backend.services.dashboard_service import build_dashboard_summary
from backend.services.model_service import model_status
from backend.services.opensquat_service import refresh_live_domains
from backend.services.scan_service import (
    normalise_domain,
    scan_domain,
    scan_response,
)
from backend.services.import_service import parse_imported_domains


app = FastAPI(
    title="Threat Hunter API",
    version="1.0.0",
)


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
# CURRENT DEMO USER
# ============================================================

DEMO_MANUAL_USER_ID = 1

# Temporary in-memory review storage because the current
# MySQL schema does not contain review fields.
REVIEWS = {}


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
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Threat Hunter API is running"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
@app.get("/api/v1/health")
def health():
    model = model_status()

    return {
        "status": "healthy",
        "model": model,
        "opensquat": {
            "status": "enabled",
        },
    }


# ============================================================
# MANUAL SCAN
# ============================================================

@app.post("/api/v1/scans")
def create_scan(
    request: DomainRequest,
    db: Session = Depends(get_db),
):
    try:
        scan = scan_domain(
            db,
            request.domain,
            "manual",
            DEMO_MANUAL_USER_ID,
        )

        return scan_response(
            scan,
            "personal",
        )

    except HTTPException:
        raise

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Scan failed: {error}",
        )


# ============================================================
# GET SCANS
# ============================================================

def _rows(
    db: Session,
    collection: str,
):
    if collection == "live":
        user_filter = "sr.user_id IS NULL"

    elif collection == "personal":
        user_filter = "sr.user_id IS NOT NULL"

    else:
        raise HTTPException(
            status_code=400,
            detail="Collection must be live or personal.",
        )

    query = text(
        f"""
        SELECT
            sr.scan_id,
            sr.user_id,
            sr.domain_id,
            sr.scan_time,
            sr.prediction_result,
            sr.risk_score,
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
        """
    )

    return db.execute(query).mappings().all()


@app.get("/api/v1/scans")
def get_scans(
    collection: str = "live",
    db: Session = Depends(get_db),
):
    rows = _rows(
        db,
        collection,
    )

    records = []

    for row in rows:

        scan_id = row["scan_id"]

        review = REVIEWS.get(
            scan_id,
            {},
        )

        risk_score = float(
            row["risk_score"] or 0
        )

        prediction = row["prediction_result"]

        if prediction is None:
            prediction = "Legitimate"

        prediction = str(
            prediction
        )

        domain = row["domain_name"] or ""

        tld = row["tld"]

        if not tld and "." in domain:
            tld = "." + domain.rsplit(
                ".",
                1,
            )[1]

        records.append(
            {
                "id": scan_id,
                "domain": domain,
                "risk_score": risk_score,
                "prediction": prediction,
                "review_status": review.get(
                    "review_status",
                    "Pending",
                ),
                "decision": review.get(
                    "decision"
                ),
                "scan_time": (
                    row["scan_time"].isoformat()
                    if row["scan_time"]
                    else None
                ),
                "tld": tld,
                "source": (
                    "manual"
                    if collection == "personal"
                    else "live"
                ),
                "original": domain,
            }
        )

    return {
        "records": records
    }


# ============================================================
# GET SINGLE SCAN
# ============================================================

@app.get("/api/v1/scans/{scan_id}")
def get_scan(
    scan_id: int,
    db: Session = Depends(get_db),
):
    query = text(
        """
        SELECT
            sr.scan_id,
            sr.user_id,
            sr.domain_id,
            sr.scan_time,
            sr.prediction_result,
            sr.risk_score,
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
        """
    )

    row = db.execute(
        query,
        {
            "scan_id": scan_id
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Scan not found.",
        )

    review = REVIEWS.get(
        scan_id,
        {},
    )

    result = {
        "id": row["scan_id"],
        "domain": row["domain_name"],
        "risk_score": float(
            row["risk_score"] or 0
        ),
        "prediction": row["prediction_result"],
        "review_status": review.get(
            "review_status",
            "Pending",
        ),
        "decision": review.get(
            "decision"
        ),
        "note": review.get(
            "note"
        ),
        "scan_time": (
            row["scan_time"].isoformat()
            if row["scan_time"]
            else None
        ),
        "source": (
            "manual"
            if row["user_id"] is not None
            else "live"
        ),
        "original": row["domain_name"],

        # Features
        "domain_age": row["domain_age"],
        "registration_period": row[
            "registration_period"
        ],
        "domain_length": row[
            "domain_length"
        ],
        "hyphens": row[
            "hyphen_count"
        ],
        "digits": row[
            "digit_count"
        ],
        "shannon_entropy": row[
            "shannon_entropy"
        ],
        "brand_keyword": row[
            "brand_keyword_detection"
        ],
        "typosquatting_similarity": row[
            "typosquatting_similarity"
        ],
        "ssl_cert_age": row[
            "ssl_certificate_age"
        ],
        "tld": row[
            "tld"
        ],

        # Model
        "model_name": row[
            "model_name"
        ] or "XGBoost",

        "confidence_score": (
            float(
                row["confidence_score"]
            )
            if row["confidence_score"] is not None
            else float(
                row["risk_score"] or 0
            ) / 100
        ),

        "explanation": row[
            "explanation"
        ],
    }

    return result


# ============================================================
# REVIEW
# ============================================================

@app.patch("/api/v1/scans/{scan_id}/review")
def save_review(
    scan_id: int,
    review: ReviewRequest,
    db: Session = Depends(get_db),
):
    if review.decision not in {
        "Confirmed Phishing",
        "False Positive",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Choose Confirmed Phishing "
                "or False Positive."
            ),
        )

    exists = db.execute(
        text(
            """
            SELECT scan_id
            FROM scan_results
            WHERE scan_id = :scan_id
            """
        ),
        {
            "scan_id": scan_id
        },
    ).first()

    if exists is None:
        raise HTTPException(
            status_code=404,
            detail="Scan not found.",
        )

    REVIEWS[scan_id] = {
        "review_status": "Completed",
        "decision": review.decision,
        "note": review.note,
        "review_date": datetime.now(
            timezone.utc
        ).isoformat(),
    }

    return {
        "id": scan_id,
        "review_status": "Completed",
        "decision": review.decision,
        "note": review.note,
    }


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

@app.get("/api/v1/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
):
    rows = _rows(
        db,
        "live",
    )

    return build_dashboard_summary(
        rows,
        datetime.now().date(),
    )


# ============================================================
# IMPORT CSV / JSON
# ============================================================

@app.post("/api/v1/imports")
async def import_scans(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    data = await file.read(
        2_000_001
    )

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

    for row_number, value in enumerate(
        domains,
        start=1,
    ):

        try:

            if not isinstance(
                value,
                str,
            ):
                raise ValueError(
                    "Domain must be text."
                )

            normalise_domain(
                value
            )

            scan_domain(
                db,
                value,
                "import",
                DEMO_MANUAL_USER_ID,
            )

            accepted += 1

        except Exception as error:

            db.rollback()

            errors.append(
                f"Row {row_number}: {error}"
            )

    return {
        "filename": file.filename,
        "accepted_count": accepted,
        "rejected_count": len(errors),
        "errors": errors,
    }


# ============================================================
# OPTIONAL OPEN-SQUAT REFRESH
# ============================================================

@app.post("/api/v1/opensquat/refresh")
def refresh_opensquat():
    try:
        return refresh_live_domains()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"OpenSquat refresh failed: {error}",
        )