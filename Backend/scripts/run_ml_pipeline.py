import sys
from pathlib import Path

import pandas as pd


# ============================================================
# PYTHON PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))


# ============================================================
# IMPORT SERVICES
# ============================================================

from services.feature_engineering import extract_features
from services.model_service import predict_domain


# ============================================================
# PATHS
# ============================================================

CANDIDATE_FILE = (
    BASE_DIR
    / "opensquat"
    / "candidate_domains.txt"
)

OUTPUT_FILE = (
    BASE_DIR
    / "opensquat"
    / "candidate_predictions_50.csv"
)


# ============================================================
# LOAD CANDIDATE DOMAINS
# ============================================================

if not CANDIDATE_FILE.exists():
    raise FileNotFoundError(
        f"Candidate file not found: {CANDIDATE_FILE}"
    )


with CANDIDATE_FILE.open("r", encoding="utf-8") as file:
    domains = [
        line.strip()
        for line in file
        if line.strip()
    ]


if not domains:
    raise RuntimeError(
        "No candidate domains found."
    )


print()
print("==========================================")
print(" THREAT HUNTER - ML PIPELINE")
print("==========================================")
print()

print(f"Candidate domains found: {len(domains)}")
print()


# ============================================================
# PROCESS DOMAINS
# ============================================================

results = []

for index, domain in enumerate(domains, start=1):

    print(
        f"[{index}/{len(domains)}] "
        f"Processing: {domain}"
    )

    try:

        # ----------------------------------------------------
        # FEATURE EXTRACTION
        # ----------------------------------------------------

        features = extract_features(domain)


        # ----------------------------------------------------
        # XGBOOST PREDICTION
        # ----------------------------------------------------

        prediction_result = predict_domain(
            features
        )


        # ----------------------------------------------------
        # COMBINE RESULTS
        # ----------------------------------------------------

        row = {
            "domain": domain,
            **features,
            **prediction_result,
        }

        results.append(row)

        print(
            f"    Phishing probability: "
            f"{prediction_result['phishing_probability']:.4f}"
        )

        print(
            f"    Prediction: "
            f"{prediction_result['prediction']}"
        )

    except Exception as error:

        print(
            f"    ERROR: {error}"
        )

        row = {
            "domain": domain,
            "error": str(error),
        }

        results.append(row)


# ============================================================
# CREATE DATAFRAME
# ============================================================

results_df = pd.DataFrame(results)


# ============================================================
# SAVE RESULTS
# ============================================================

results_df.to_csv(
    OUTPUT_FILE,
    index=False
)


# ============================================================
# SUMMARY
# ============================================================

successful = (
    results_df["prediction"].notna().sum()
    if "prediction" in results_df.columns
    else 0
)

phishing = (
    (
        results_df["prediction"] == 1
    ).sum()
    if "prediction" in results_df.columns
    else 0
)

legitimate = (
    (
        results_df["prediction"] == 0
    ).sum()
    if "prediction" in results_df.columns
    else 0
)


print()
print("==========================================")
print(" PIPELINE COMPLETED")
print("==========================================")
print()

print(f"Domains processed: {len(domains)}")
print(f"Successful predictions: {successful}")
print(f"Predicted phishing: {phishing}")
print(f"Predicted legitimate: {legitimate}")

print()
print("Results saved to:")
print(OUTPUT_FILE)

print()
print("==========================================")