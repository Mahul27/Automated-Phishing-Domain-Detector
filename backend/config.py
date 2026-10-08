import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL


# ============================================================
# PROJECT PATHS
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = Path(__file__).resolve().parent


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv(PROJECT_ROOT / ".env.local")
load_dotenv(BACKEND_ROOT / ".env", override=True)


# ============================================================
# SUPABASE CONFIGURATION
# ============================================================

SUPABASE_URL = (
    os.getenv("SUPABASE_URL")
    or os.getenv("VITE_SUPABASE_URL")
)

SUPABASE_PUBLISHABLE_KEY = (
    os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")
)


# ============================================================
# MYSQL DATABASE CONFIGURATION
# ============================================================

if os.getenv("DB_HOST"):

    DATABASE_URL = URL.create(
        drivername="mysql+pymysql",
        username=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME"),
    )

else:

    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BACKEND_ROOT / 'data' / 'scans.db'}"
    )


# ============================================================
# AUTOMATIC SCANNING
# ============================================================

AUTO_SCAN_ENABLED = (
    os.getenv("AUTO_SCAN_ENABLED", "true").lower()
    in ("1", "true", "yes", "on")
)

AUTO_SCAN_INTERVAL_HOURS = float(
    os.getenv("AUTO_SCAN_INTERVAL_HOURS", "24")
)

LIVE_SCAN_LIMIT = int(
    os.getenv("LIVE_SCAN_LIMIT", "1000")
)

# ============================================================
# BACKEND SETTINGS
# ============================================================

HOST = os.getenv("HOST", "127.0.0.1")

PORT = int(
    os.getenv("PORT", "8000")
)


# ============================================================
# DATASET
# ============================================================

DATASET_PATH = Path(
    os.getenv(
        "DATASET_PATH",
        str(
            PROJECT_ROOT
            / "Dataset"
            / "ML_Final_10_Features_Cleaned.csv"
        )
    )
)


# ============================================================
# MODEL
# ============================================================

MODEL_PATH = Path(
    os.getenv(
        "MODEL_PATH",
        str(
            PROJECT_ROOT
            / "Dataset"
            / "final_xgboost_model.json"
        )
    )
)