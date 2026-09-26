import sys
from pathlib import Path

import pandas as pd


# ============================================================
# PYTHON PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))


# ============================================================
# IMPORT DATABASE SERVICE
# ============================================================

from services.database_service import save_scan_result


# ============================================================
# FILE
# ============================================================

INPUT_FILE = (
    BASE_DIR
    / "opensquat"
    / "candidate_predictions_50.csv"
)


# ============================================================
# LOAD CSV
# ============================================================

if not INPUT_FILE.exists():
    raise FileNotFoundError(
        f"Prediction file not found: {INPUT_FILE}"
    )


df = pd.read_csv(INPUT_FILE)


print()
print("=" * 50)
print(" THREAT HUNTER - CSV TO MYSQL IMPORT")
print("=" * 50)
print()

print(f"Rows found: {len(df)}")
print()


# ============================================================
# REQUIRED COLUMNS
# ============================================================

required_columns = [
    "domain",
    "domain_age_days",
    "registration_period_days",
    "domain_length",
    "num_hyphens",
    "num_digits",
    "entropy_domain",
    "brand_keyword",
    "typosquatting_score",
    "ssl_certificate_age_days",
    "tld",
    "prediction",
    "legitimate_probability",
    "phishing_probability",
]


missing_columns = [
    column
    for column in required_columns
    if column not in df.columns
]


if missing_columns:
    raise RuntimeError(
        "Missing columns: "
        + ", ".join(missing_columns)
    )


# ============================================================
# IMPORT RESULTS
# ============================================================

successful = 0
failed = 0

for index, row in df.iterrows():

    domain = str(row["domain"])

    print(
        f"[{index + 1}/{len(df)}] "
        f"Saving {domain}..."
    )

    try:

        features = {
            "domain_age_days": (
                None
                if pd.isna(row["domain_age_days"])
                else int(row["domain_age_days"])
            ),

            "registration_period_days": (
                None
                if pd.isna(
                    row["registration_period_days"]
                )
                else int(
                    row["registration_period_days"]
                )
            ),

            "domain_length": int(
                row["domain_length"]
            ),

            "num_hyphens": int(
                row["num_hyphens"]
            ),

            "num_digits": (
                None
                if pd.isna(row["num_digits"])
                else int(row["num_digits"])
            ),

            "entropy_domain": float(
                row["entropy_domain"]
            ),

            "brand_keyword": (
                None
                if pd.isna(row["brand_keyword"])
                else int(row["brand_keyword"])
            ),

            "typosquatting_score": (
                None
                if pd.isna(
                    row["typosquatting_score"]
                )
                else float(
                    row["typosquatting_score"]
                )
            ),

            "ssl_certificate_age_days": (
                None
                if pd.isna(
                    row["ssl_certificate_age_days"]
                )
                else int(
                    row["ssl_certificate_age_days"]
                )
            ),

            "tld": str(row["tld"]),
        }


        result = save_scan_result(
            domain=domain,
            features=features,
            prediction=int(
                row["prediction"]
            ),
            legitimate_probability=float(
                row["legitimate_probability"]
            ),
            phishing_probability=float(
                row["phishing_probability"]
            ),
            user_id=None,
        )


        successful += 1

        print(
            f"    Scan ID: "
            f"{result['scan_id']}"
        )

    except Exception as error:

        failed += 1

        print(
            f"    ERROR: {error}"
        )


# ============================================================
# SUMMARY
# ============================================================

print()
print("=" * 50)
print(" IMPORT COMPLETED")
print("=" * 50)
print()

print(f"Rows found:        {len(df)}")
print(f"Successfully saved: {successful}")
print(f"Failed:             {failed}")

print()
print("=" * 50)