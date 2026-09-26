import sys
from pathlib import Path


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


# ============================================================
# LOAD CANDIDATES
# ============================================================

with CANDIDATE_FILE.open("r", encoding="utf-8") as file:
    domains = [
        line.strip()
        for line in file
        if line.strip()
    ]


if not domains:
    raise RuntimeError(
        "No candidate domains found in candidate_domains.txt."
    )


# ============================================================
# SELECT ONE DOMAIN
# ============================================================

domain = domains[0]


# ============================================================
# PIPELINE TEST
# ============================================================

print()
print("==========================================")
print(" THREAT HUNTER - PIPELINE TEST")
print("==========================================")
print()

print(f"Testing domain: {domain}")
print()

print("Step 1: Extracting features...")

features = extract_features(domain)

print("Feature extraction completed.")

print()
print("Step 2: Running XGBoost prediction...")

result = predict_domain(features)

print("Prediction completed.")


# ============================================================
# DISPLAY RESULTS
# ============================================================

print()
print("==========================================")
print(" RESULTS")
print("==========================================")

print()
print(f"Domain: {domain}")

print()
print("10 Features:")

for feature, value in features.items():
    print(f"  {feature}: {value}")

print()
print("XGBoost Result:")

print(
    f"  Prediction: "
    f"{result['prediction']}"
)

print(
    f"  Legitimate probability: "
    f"{result['legitimate_probability']:.6f}"
)

print(
    f"  Phishing probability: "
    f"{result['phishing_probability']:.6f}"
)

print()
print("==========================================")
print(" PIPELINE TEST COMPLETED")
print("==========================================")