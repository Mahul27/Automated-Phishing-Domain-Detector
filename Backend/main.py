# ============================================================
# THREAT HUNTER - FASTAPI BACKEND
# AI-POWERED PHISHING DOMAIN DETECTOR
# ============================================================
#
# This is the main FastAPI backend for the project.
#
# Main responsibilities:
#
# 1. Provide REST API endpoints for the React frontend
# 2. Connect to Azure MySQL
# 3. Process manual domain scans
# 4. Run the existing feature-engineering service
# 5. Run the existing XGBoost model service
# 6. Store scan results in MySQL
# 7. Provide live records to the Live Dashboard
# 8. Provide personal records to the Analyst Workspace
# 9. Provide detailed scan information to Review Details
#
# IMPORTANT PROJECT DATA SEPARATION
#
# Automated/OpenSquat:
#
#     user_id = NULL
#     collection = LIVE
#
# Manual/user scan:
#
#     user_id = 1
#     collection = PERSONAL
#
# This keeps manual scans out of the Live Dashboard.
#
# ============================================================


# ============================================================
# IMPORTS
# ============================================================

# FastAPI is our REST API framework.
from fastapi import (
    FastAPI,
    Depends,
    HTTPException
)

# CORS allows React running on localhost:5173 to communicate
# with FastAPI running on port 8000.
from fastapi.middleware.cors import CORSMiddleware

# Pydantic validates incoming JSON request bodies.
from pydantic import BaseModel

# SQLAlchemy tools for database operations.
from sqlalchemy import text
from sqlalchemy.orm import Session

# Database session dependency.
from database.database import get_db

# datetime is used for scan timestamps and dashboard trends.
from datetime import datetime, timedelta

# sys and pathlib allow us to safely import our backend
# service modules.
import sys
from pathlib import Path


# ============================================================
# BACKEND PATH
# ============================================================

# BASE_DIR points to:
#
# C:\Users\johal\Threat_Hunters\Backend
#
BASE_DIR = Path(__file__).resolve().parent

# Add Backend to Python's import path.
#
# This allows us to import:
#
#     services.feature_engineering
#     services.model_service
#
sys.path.insert(
    0,
    str(BASE_DIR)
)


# ============================================================
# IMPORT EXISTING PROJECT SERVICES
# ============================================================

# IMPORTANT:
#
# We are reusing the exact feature-engineering service already
# used by the OpenSquat/ML pipeline.
#
# This prevents the manual scan from using different feature
# calculations.
#
from services.feature_engineering import extract_features

# Reuse the existing XGBoost prediction service.
from services.model_service import predict_domain


# ============================================================
# APPLICATION CONFIGURATION
# ============================================================

app = FastAPI(
    title="Threat Hunter API",
    description="AI-powered phishing domain detection backend",
    version="1.0.0"
)


# ============================================================
# CORS CONFIGURATION
# ============================================================
#
# React/Vite normally runs on:
#
#     http://localhost:5173
#
# or:
#
#     http://127.0.0.1:5173
#
# FastAPI runs on:
#
#     http://127.0.0.1:8000
#
# Because these are different origins, the browser requires
# CORS permission.
#
# ============================================================

app.add_middleware(
    CORSMiddleware,

    # Allow both common Vite development addresses.
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],

    # Allow cookies/authentication headers if needed later.
    allow_credentials=True,

    # Allow all normal HTTP methods.
    allow_methods=["*"],

    # Allow normal API headers.
    allow_headers=["*"],
)


# ============================================================
# DEMO USER CONFIGURATION
# ============================================================
#
# The current frontend integration document states that the
# login pages currently use localStorage and do not send a
# FastAPI/Supabase user ID to the backend.
#
# Therefore, for the current demo integration, manual scans
# are associated with the existing demo database user:
#
#     user_id = 1
#
# This is IMPORTANT because:
#
#     user_id = NULL -> LIVE/AUTOMATED
#
#     user_id = 1    -> PERSONAL/MANUAL
#
# This prevents manual scans from increasing Live Dashboard
# totals.
#
# Later, when real authentication is connected, this constant
# can be replaced by the authenticated user's ID.
#
# ============================================================

DEMO_MANUAL_USER_ID = 1


# ============================================================
# REQUEST MODEL
# ============================================================

class DomainRequest(BaseModel):
    """
    Request body used when the frontend creates a manual scan.

    Frontend sends:

        {
            "domain": "example.com"
        }

    The integration document specifies exactly this request
    shape for POST /api/v1/scans.
    """

    domain: str


# ============================================================
# REVIEW REQUEST MODEL
# ============================================================

class ReviewRequest(BaseModel):
    """
    Request body used when an analyst submits a review.

    Example:

        {
            "decision": "Confirmed Phishing",
            "note": "Brand impersonation detected"
        }

    The frontend integration document specifies these decision
    values:

        Confirmed Phishing
        False Positive
    """

    decision: str
    note: str | None = None


# ============================================================
# HELPER:
# NORMALISE DOMAIN
# ============================================================

def normalise_domain(domain: str):
    """
    Clean the domain supplied by the user.

    The manual search field should contain a domain such as:

        example.com

    If the user enters:

        https://example.com/

    this helper removes the common URL parts so that the
    feature-engineering service receives the domain cleanly.
    """

    domain = domain.strip().lower()

    # Remove HTTP/HTTPS if supplied.
    if domain.startswith("https://"):
        domain = domain[8:]

    elif domain.startswith("http://"):
        domain = domain[7:]

    # Remove anything after the first slash.
    domain = domain.split("/", 1)[0]

    return domain


# ============================================================
# HELPER:
# NORMALISE PREDICTION
# ============================================================

def normalise_prediction(value):
    """
    Convert the model prediction into the exact text expected
    by the React frontend.

    The frontend expects:

        Phishing

    or:

        Legitimate
    """

    if value is None:
        return "Legitimate"

    value = str(value).strip().lower()

    if value in {
        "1",
        "true",
        "phishing",
        "malicious",
        "suspicious"
    }:
        return "Phishing"

    return "Legitimate"


# ============================================================
# HELPER:
# NORMALISE RISK SCORE
# ============================================================

def normalise_risk_score(value):
    """
    Convert a model probability/risk value into a percentage
    between 0 and 100.

    Example:

        0.8007 -> 80.07

        80.07 -> 80.07
    """

    if value is None:
        return 0.0

    try:

        score = float(value)

        # If the value is a probability between 0 and 1,
        # convert it into a percentage.
        if 0 <= score <= 1:
            score *= 100

        # Keep the value between 0 and 100.
        score = max(
            0.0,
            min(100.0, score)
        )

        return round(
            score,
            2
        )

    except (
        ValueError,
        TypeError
    ):

        return 0.0


# ============================================================
# HELPER:
# NORMALISE DATETIME
# ============================================================

def normalise_datetime(value):
    """
    Convert a database datetime/string into a Python datetime.

    MySQL normally returns a datetime object, but this helper
    also supports common string formats.
    """

    if value is None:
        return None

    # Already a datetime.
    if isinstance(
        value,
        datetime
    ):
        return value

    value = str(value).strip()

    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f"
    ]

    for date_format in formats:

        try:

            return datetime.strptime(
                value,
                date_format
            )

        except ValueError:
            continue

    return None


# ============================================================
# HELPER:
# RISK CATEGORY
# ============================================================

def get_risk_category(risk_score):
    """
    Group the numerical risk score into the dashboard's
    three categories.

        0 - 39.99     Low
        40 - 69.99    Medium
        70 - 100      High
    """

    if risk_score >= 70:
        return "High"

    if risk_score >= 40:
        return "Medium"

    return "Low"


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
def root():
    """
    Simple endpoint confirming that the API is running.
    """

    return {
        "message": "Threat Hunter API is running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    """
    Health-check endpoint.

    Used by the frontend/backend integration to confirm that
    FastAPI is running.
    """

    return {
        "status": "healthy"
    }


# ============================================================
# DATABASE CONNECTION TEST
# ============================================================

@app.get("/db-test")
def database_test(
    db: Session = Depends(get_db)
):
    """
    Test the Azure MySQL connection.

    The query counts records in the domains table.
    """

    result = db.execute(
        text(
            "SELECT COUNT(*) FROM domains"
        )
    )

    count = result.scalar()

    return {
        "database": "connected",
        "domains_count": count
    }


# ============================================================
# DATABASE SCHEMA TEST
# ============================================================

@app.get("/db-schema")
def database_schema(
    db: Session = Depends(get_db)
):
    """
    Display the structure of the main project tables.

    Useful during backend development and debugging.
    """

    tables = [
        "app_users",
        "domains",
        "scan_results",
        "domain_features",
        "model_outputs"
    ]

    output = {}

    for table in tables:

        try:

            rows = db.execute(
                text(
                    f"DESCRIBE `{table}`"
                )
            ).mappings().all()

            output[table] = [
                dict(row)
                for row in rows
            ]

        except Exception as error:

            output[table] = {
                "error": str(error)
            }

    return output


# ============================================================
# BASIC PREDICTION TEST
# ============================================================

@app.post("/predict")
def predict_test(
    request: DomainRequest
):
    """
    Simple API communication test.

    This endpoint only confirms that FastAPI can receive a
    domain.

    It is NOT the manual scanning pipeline.

    The actual manual scan endpoint is:

        POST /api/v1/scans
    """

    return {
        "domain": request.domain,
        "message": "Domain received successfully"
    }


# ============================================================
# MANUAL SCAN ENDPOINT
# ============================================================

@app.post("/api/v1/scans")
def create_manual_scan(
    request: DomainRequest,
    db: Session = Depends(get_db)
):
    """
    Create and process one manual domain scan.

    ========================================================
    REQUEST
    ========================================================

        POST /api/v1/scans

    Body:

        {
            "domain": "example.com"
        }

    ========================================================
    PIPELINE
    ========================================================

        Domain submitted
              |
              v
        Domain cleaned
              |
              v
        Feature extraction
              |
              v
        XGBoost prediction
              |
              v
        Save domain
              |
              v
        Save scan result
              |
              v
        Save 10 features
              |
              v
        Save model output
              |
              v
        Return scan ID

    ========================================================
    PERSONAL COLLECTION
    ========================================================

    This scan uses:

        user_id = DEMO_MANUAL_USER_ID

    Therefore it is a personal/manual record.

    It will NOT appear in:

        collection=live

    It WILL appear in:

        collection=personal
    """

    # --------------------------------------------------------
    # STEP 1:
    # CLEAN DOMAIN
    # --------------------------------------------------------

    domain = normalise_domain(
        request.domain
    )

    # Make sure something was actually supplied.
    if not domain:

        raise HTTPException(
            status_code=400,
            detail="Domain cannot be empty."
        )

    # --------------------------------------------------------
    # STEP 2:
    # FEATURE EXTRACTION
    # --------------------------------------------------------
    #
    # Reuse the same feature-engineering service used by the
    # existing ML pipeline.
    #
    # This calculates the project's final 10 features:
    #
    # 1. Domain Age
    # 2. Registration Period
    # 3. Domain Length
    # 4. Number of Hyphens
    # 5. Number of Digits
    # 6. Shannon Entropy
    # 7. Brand Keyword
    # 8. Typosquatting Similarity
    # 9. SSL Certificate Age
    # 10. TLD
    #
    # --------------------------------------------------------

    try:

        features = extract_features(
            domain
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "Feature extraction failed: "
                f"{error}"
            )
        )

    # --------------------------------------------------------
    # STEP 3:
    # XGBOOST PREDICTION
    # --------------------------------------------------------
    #
    # Reuse the existing model_service.py.
    #
    # This keeps manual scans consistent with the existing
    # OpenSquat ML pipeline.
    #
    # --------------------------------------------------------

    try:

        prediction_result = predict_domain(
            features
        )

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                "XGBoost prediction failed: "
                f"{error}"
            )
        )

    # --------------------------------------------------------
    # STEP 4:
    # READ MODEL RESULT
    # --------------------------------------------------------

    # The existing model service returns the prediction and
    # phishing probability.
    prediction_value = prediction_result.get(
        "prediction"
    )

    phishing_probability = prediction_result.get(
        "phishing_probability"
    )

    # Convert the prediction into frontend text.
    prediction_text = normalise_prediction(
        prediction_value
    )

    # Convert probability into 0-100 risk score.
    risk_score = normalise_risk_score(
        phishing_probability
    )

    # --------------------------------------------------------
    # STEP 5:
    # SAVE DOMAIN
    # --------------------------------------------------------
    #
    # First check whether the domain already exists.
    #
    # We do NOT create duplicate domain master records.
    #
    # A previous scan of the same domain can still have its
    # own scan_results record.
    #
    # --------------------------------------------------------

    existing_domain = db.execute(
        text(
            """
            SELECT domain_id
            FROM domains
            WHERE domain_name = :domain
            LIMIT 1
            """
        ),
        {
            "domain": domain
        }
    ).first()

    if existing_domain:

        # Reuse existing domain_id.
        domain_id = existing_domain[0]

    else:

        # Create a new domain master record.
        db.execute(
            text(
                """
                INSERT INTO domains
                    (domain_name)
                VALUES
                    (:domain)
                """
            ),
            {
                "domain": domain
            }
        )

        # Retrieve the newly created ID.
        domain_id = db.execute(
            text(
                """
                SELECT domain_id
                FROM domains
                WHERE domain_name = :domain
                LIMIT 1
                """
            ),
            {
                "domain": domain
            }
        ).scalar()

    # --------------------------------------------------------
    # STEP 6:
    # CREATE SCAN RESULT
    # --------------------------------------------------------
    #
    # user_id is deliberately NOT NULL.
    #
    # This marks the scan as PERSONAL.
    #
    # OpenSquat automated records use user_id = NULL.
    #
    # --------------------------------------------------------

    db.execute(
        text(
            """
            INSERT INTO scan_results
                (
                    user_id,
                    domain_id,
                    scan_time,
                    prediction_result,
                    risk_score
                )
            VALUES
                (
                    :user_id,
                    :domain_id,
                    :scan_time,
                    :prediction_result,
                    :risk_score
                )
            """
        ),
        {
            "user_id": DEMO_MANUAL_USER_ID,

            "domain_id": domain_id,

            "scan_time": datetime.now(),

            "prediction_result": prediction_text,

            "risk_score": risk_score
        }
    )

    # Retrieve the scan ID.
    scan_id = db.execute(
        text(
            """
            SELECT scan_id
            FROM scan_results
            WHERE user_id = :user_id
              AND domain_id = :domain_id
            ORDER BY scan_id DESC
            LIMIT 1
            """
        ),
        {
            "user_id": DEMO_MANUAL_USER_ID,
            "domain_id": domain_id
        }
    ).scalar()

    # --------------------------------------------------------
    # STEP 7:
    # SAVE THE 10 FEATURES
    # --------------------------------------------------------
    #
    # These column names match the project's database feature
    # structure used by the Review Details endpoint.
    #
    # --------------------------------------------------------

    db.execute(
        text(
            """
            INSERT INTO domain_features
                (
                    scan_id,
                    domain_age,
                    registration_period,
                    domain_length,
                    hyphen_count,
                    digit_count,
                    shannon_entropy,
                    brand_keyword_detection,
                    typosquatting_similarity,
                    ssl_certificate_age,
                    tld
                )
            VALUES
                (
                    :scan_id,
                    :domain_age,
                    :registration_period,
                    :domain_length,
                    :hyphen_count,
                    :digit_count,
                    :shannon_entropy,
                    :brand_keyword_detection,
                    :typosquatting_similarity,
                    :ssl_certificate_age,
                    :tld
                )
            """
        ),
        {
            "scan_id": scan_id,

            "domain_age": features.get(
                "domain_age_days"
            ),

            "registration_period": features.get(
                "registration_period_days"
            ),

            "domain_length": features.get(
                "domain_length"
            ),

            "hyphen_count": features.get(
                "num_hyphens"
            ),

            "digit_count": features.get(
                "num_digits"
            ),

            "shannon_entropy": features.get(
                "entropy_domain"
            ),

            "brand_keyword_detection": features.get(
                "brand_keyword"
            ),

            "typosquatting_similarity": features.get(
                "typosquatting_score"
            ),

            "ssl_certificate_age": features.get(
                "ssl_certificate_age_days"
            ),

            "tld": features.get(
                "tld"
            )
        }
    )

    # --------------------------------------------------------
    # STEP 8:
    # SAVE MODEL OUTPUT
    # --------------------------------------------------------
    #
    # Store the model name and confidence so Review Details
    # can display model information later.
    #
    # --------------------------------------------------------

    try:

        db.execute(
            text(
                """
                INSERT INTO model_outputs
                    (
                        scan_id,
                        model_name,
                        confidence_score,
                        explanation
                    )
                VALUES
                    (
                        :scan_id,
                        :model_name,
                        :confidence_score,
                        :explanation
                    )
                """
            ),
            {
                "scan_id": scan_id,

                "model_name": "XGBoost",

                "confidence_score": (
                    phishing_probability
                ),

                "explanation": None
            }
        )

    except Exception:
        #
        # If the optional model_outputs table/columns differ,
        # don't allow that optional storage problem to hide
        # the main scan result.
        #
        pass

    # --------------------------------------------------------
    # STEP 9:
    # COMMIT EVERYTHING
    # --------------------------------------------------------

    db.commit()

    # --------------------------------------------------------
    # STEP 10:
    # RETURN RESULT TO FRONTEND
    # --------------------------------------------------------
    #
    # The frontend requires at least:
    #
    #     id
    #
    # Returning the complete result is better because it allows
    # the frontend to immediately navigate to Review Details.
    #
    # --------------------------------------------------------

    return {
        "id": scan_id,

        "domain": domain,

        "risk_score": risk_score,

        "prediction": prediction_text,

        "review_status": "Pending",

        "decision": None,

        "scan_time": datetime.now().isoformat(),

        "tld": features.get(
            "tld"
        ),

        "source": "manual",

        "original": domain,

        # Return all ten features as well.
        "domain_age": features.get(
            "domain_age_days"
        ),

        "registration_period": features.get(
            "registration_period_days"
        ),

        "domain_length": features.get(
            "domain_length"
        ),

        "hyphens": features.get(
            "num_hyphens"
        ),

        "digits": features.get(
            "num_digits"
        ),

        "shannon_entropy": features.get(
            "entropy_domain"
        ),

        "brand_keyword": features.get(
            "brand_keyword"
        ),

        "typosquatting_similarity": features.get(
            "typosquatting_score"
        ),

        "ssl_cert_age": features.get(
            "ssl_certificate_age_days"
        )
    }


# ============================================================
# GET SCANS
# ============================================================

@app.get("/api/v1/scans")
def get_scans(
    collection: str = "live",
    db: Session = Depends(get_db)
):
    """
    Return either live or personal scan records.

    collection=live:

        user_id IS NULL

    collection=personal:

        user_id IS NOT NULL

    This keeps the two frontend collections separate.
    """

    # --------------------------------------------------------
    # VALIDATE COLLECTION
    # --------------------------------------------------------

    if collection not in {
        "live",
        "personal"
    }:

        raise HTTPException(
            status_code=400,
            detail="Collection must be personal or live."
        )

    # --------------------------------------------------------
    # CHOOSE DATABASE FILTER
    # --------------------------------------------------------

    if collection == "live":

        filter_sql = (
            "sr.user_id IS NULL"
        )

    else:

        filter_sql = (
            "sr.user_id IS NOT NULL"
        )

    # --------------------------------------------------------
    # GET RECORDS
    # --------------------------------------------------------

    query = text(
        f"""
        SELECT
            sr.scan_id,
            sr.user_id,
            sr.domain_id,
            sr.scan_time,
            sr.prediction_result,
            sr.risk_score,
            d.domain_name
        FROM scan_results sr
        INNER JOIN domains d
            ON sr.domain_id = d.domain_id
        WHERE {filter_sql}
        ORDER BY sr.scan_time DESC
        """
    )

    rows = db.execute(
        query
    ).mappings().all()

    records = []

    # --------------------------------------------------------
    # FORMAT RECORDS FOR REACT
    # --------------------------------------------------------

    for row in rows:

        risk_score = normalise_risk_score(
            row["risk_score"]
        )

        prediction = normalise_prediction(
            row["prediction_result"]
        )

        domain = row["domain_name"] or ""

        # Extract TLD.
        if "." in domain:

            tld = (
                "."
                + domain.rsplit(
                    ".",
                    1
                )[1]
            )

        else:

            tld = ""

        records.append(
            {
                "id": row["scan_id"],

                "domain": domain,

                "risk_score": risk_score,

                "prediction": prediction,

                "review_status": "Pending",

                "decision": None,

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

                "original": domain
            }
        )

    return {
        "records": records
    }


# ============================================================
# GET ONE SCAN
# ============================================================

@app.get("/api/v1/scans/{scan_id}")
def get_scan(
    scan_id: int,
    db: Session = Depends(get_db)
):
    """
    Return the full result for one scan.

    Used by:

        /review/live/{id}

    and:

        /review/personal/{id}
    """

    # --------------------------------------------------------
    # GET SCAN + DOMAIN
    # --------------------------------------------------------

    scan = db.execute(
        text(
            """
            SELECT
                sr.scan_id,
                sr.user_id,
                sr.domain_id,
                sr.scan_time,
                sr.prediction_result,
                sr.risk_score,
                d.domain_name
            FROM scan_results sr
            INNER JOIN domains d
                ON sr.domain_id = d.domain_id
            WHERE sr.scan_id = :scan_id
            """
        ),
        {
            "scan_id": scan_id
        }
    ).mappings().first()

    if scan is None:

        raise HTTPException(
            status_code=404,
            detail="Scan not found."
        )

    # --------------------------------------------------------
    # GET FEATURES
    # --------------------------------------------------------

    features = db.execute(
        text(
            """
            SELECT
                domain_age,
                registration_period,
                domain_length,
                hyphen_count,
                digit_count,
                shannon_entropy,
                brand_keyword_detection,
                typosquatting_similarity,
                ssl_certificate_age,
                tld
            FROM domain_features
            WHERE scan_id = :scan_id
            """
        ),
        {
            "scan_id": scan_id
        }
    ).mappings().first()

    # --------------------------------------------------------
    # GET MODEL OUTPUT
    # --------------------------------------------------------

    model_output = db.execute(
        text(
            """
            SELECT
                model_name,
                confidence_score,
                explanation
            FROM model_outputs
            WHERE scan_id = :scan_id
            ORDER BY output_id DESC
            LIMIT 1
            """
        ),
        {
            "scan_id": scan_id
        }
    ).mappings().first()

    # --------------------------------------------------------
    # BASIC RESULT
    # --------------------------------------------------------

    result = {
        "id": scan["scan_id"],

        "domain": scan["domain_name"],

        "risk_score": normalise_risk_score(
            scan["risk_score"]
        ),

        "prediction": normalise_prediction(
            scan["prediction_result"]
        ),

        "review_status": "Pending",

        "decision": None,

        "scan_time": (
            scan["scan_time"].isoformat()
            if scan["scan_time"]
            else None
        ),

        "source": (
            "manual"
            if scan["user_id"] is not None
            else "live"
        ),

        "original": scan["domain_name"]
    }

    # --------------------------------------------------------
    # ADD FEATURE VALUES
    # --------------------------------------------------------

    if features:

        result.update(
            {
                "domain_age": features[
                    "domain_age"
                ],

                "registration_period": features[
                    "registration_period"
                ],

                "domain_length": features[
                    "domain_length"
                ],

                "hyphens": features[
                    "hyphen_count"
                ],

                "digits": features[
                    "digit_count"
                ],

                "shannon_entropy": features[
                    "shannon_entropy"
                ],

                "brand_keyword": features[
                    "brand_keyword_detection"
                ],

                "typosquatting_similarity": features[
                    "typosquatting_similarity"
                ],

                "ssl_cert_age": features[
                    "ssl_certificate_age"
                ],

                "tld": features[
                    "tld"
                ]
            }
        )

    # --------------------------------------------------------
    # ADD MODEL INFORMATION
    # --------------------------------------------------------

    if model_output:

        result["model_name"] = (
            model_output["model_name"]
        )

        result["confidence_score"] = (
            float(
                model_output[
                    "confidence_score"
                ]
            )
        )

        result["explanation"] = (
            model_output["explanation"]
        )

    else:

        result["model_name"] = "XGBoost"

        result["confidence_score"] = (
            result["risk_score"] / 100
        )

        result["explanation"] = None

    return result


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

@app.get("/api/v1/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db)
):
    """
    Generate the Live Dashboard summary.

    ONLY automated/live records are counted.

    Therefore:

        user_id IS NULL

    Manual scans do NOT increase these totals.
    """

    # --------------------------------------------------------
    # GET LIVE SCANS
    # --------------------------------------------------------

    rows = db.execute(
        text(
            """
            SELECT
                sr.scan_id,
                sr.scan_time,
                sr.prediction_result,
                sr.risk_score
            FROM scan_results sr
            WHERE sr.user_id IS NULL
            ORDER BY sr.scan_time DESC
            """
        )
    ).mappings().all()

    # --------------------------------------------------------
    # INITIAL COUNTERS
    # --------------------------------------------------------

    domains_monitored = 0
    high_risk_alerts = 0

    # Manual review persistence is not yet represented in the
    # current scan_results schema, so live records are pending.
    pending_review = len(rows)

    reviewed = 0

    risk_distribution = {
        "Low": 0,
        "Medium": 0,
        "High": 0
    }

    # --------------------------------------------------------
    # CREATE SEVEN-DAY TREND
    # --------------------------------------------------------

    today = datetime.now().date()

    weekly_trend = []

    for days_ago in range(
        6,
        -1,
        -1
    ):

        current_date = (
            today
            - timedelta(
                days=days_ago
            )
        )

        weekly_trend.append(
            {
                "name": current_date.strftime(
                    "%a"
                ),
                "detected": 0,
                "critical": 0
            }
        )

    # --------------------------------------------------------
    # PROCESS LIVE SCANS
    # --------------------------------------------------------

    for row in rows:

        domains_monitored += 1

        risk_score = normalise_risk_score(
            row["risk_score"]
        )

        category = get_risk_category(
            risk_score
        )

        risk_distribution[
            category
        ] += 1

        if risk_score >= 70:

            high_risk_alerts += 1

        # ----------------------------------------------------
        # ADD TO SEVEN-DAY GRAPH
        # ----------------------------------------------------

        scan_datetime = normalise_datetime(
            row["scan_time"]
        )

        if scan_datetime:

            scan_date = scan_datetime.date()

            for index, trend_item in enumerate(
                weekly_trend
            ):

                expected_date = (
                    today
                    - timedelta(
                        days=6 - index
                    )
                )

                if scan_date == expected_date:

                    trend_item[
                        "detected"
                    ] += 1

                    if risk_score >= 70:

                        trend_item[
                            "critical"
                        ] += 1

                    break

    return {
        "domains_monitored": domains_monitored,

        "high_risk_alerts": high_risk_alerts,

        "pending_review": pending_review,

        "reviewed": reviewed,

        "risk_distribution": risk_distribution,

        "weekly_trend": weekly_trend
    }


# ============================================================
# SAVE ANALYST REVIEW
# ============================================================

@app.patch("/api/v1/scans/{scan_id}/review")
def update_scan_review(
    scan_id: int,
    review: ReviewRequest,
    db: Session = Depends(get_db)
):
    """
    Receive an analyst review decision.

    Frontend sends:

        {
            "decision": "Confirmed Phishing",
            "note": "Optional analyst note"
        }

    IMPORTANT:

    The current database structure we have been working with
    does not contain dedicated decision/note fields in
    scan_results.

    Therefore this endpoint currently verifies that the scan
    exists and returns the review information.

    Persistent analyst review storage should be implemented
    once the team confirms the final review table/columns.
    """

    # --------------------------------------------------------
    # VALIDATE DECISION
    # --------------------------------------------------------

    allowed_decisions = {
        "Confirmed Phishing",
        "False Positive"
    }

    if review.decision not in allowed_decisions:

        raise HTTPException(
            status_code=400,
            detail=(
                "Decision must be "
                "'Confirmed Phishing' or "
                "'False Positive'."
            )
        )

    # --------------------------------------------------------
    # CHECK SCAN EXISTS
    # --------------------------------------------------------

    scan = db.execute(
        text(
            """
            SELECT scan_id
            FROM scan_results
            WHERE scan_id = :scan_id
            """
        ),
        {
            "scan_id": scan_id
        }
    ).first()

    if scan is None:

        raise HTTPException(
            status_code=404,
            detail="Scan not found."
        )

    # --------------------------------------------------------
    # CURRENT RESPONSE
    # --------------------------------------------------------

    return {
        "id": scan_id,

        "review_status": "Completed",

        "decision": review.decision,

        "note": review.note
    }


# ============================================================
# STARTING THE SERVER
# ============================================================
#
# Start FastAPI from PowerShell:
#
#     uvicorn main:app --reload
#
# The API will be available at:
#
#     http://127.0.0.1:8000
#
# Swagger:
#
#     http://127.0.0.1:8000/docs
#
# ============================================================