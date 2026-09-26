import sys
from pathlib import Path


# ============================================================
# PYTHON PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))


# ============================================================
# IMPORTS
# ============================================================

from services.feature_engineering import extract_features
from services.model_service import predict_domain
from services.database_service import save_scan_result


# ============================================================
# TEST DOMAIN
# ============================================================

DOMAIN = "googlen2p.com"


# ============================================================
# START TEST
# ============================================================

print()
print("==========================================")
print(" THREAT HUNTER - DATABASE STORAGE TEST")
print("==========================================")
print()

print(f"Test domain: {DOMAIN}")
print()


# ============================================================
# 1. FEATURE EXTRACTION
# ============================================================

print("Step 1: Extracting features...")

features = extract_features(DOMAIN)

print("Feature extraction completed.")
print()


# ============================================================
# 2. XGBOOST PREDICTION
# ============================================================

print("Step 2: Running XGBoost prediction...")

prediction_result = predict_domain(features)

print("Prediction completed.")
print()


# ============================================================
# 3. SAVE TO MYSQL
# ============================================================

print("Step 3: Saving result to Azure MySQL...")

database_result = save_scan_result(
    domain=DOMAIN,
    features=features,
    prediction=prediction_result["prediction"],
    legitimate_probability=prediction_result[
        "legitimate_probability"
    ],
    phishing_probability=prediction_result[
        "phishing_probability"
    ],
    user_id=None
)

print("Database storage completed.")
print()


# ============================================================
# DISPLAY RESULT
# ============================================================

print("==========================================")
print(" DATABASE RESULT")
print("==========================================")
print()

print(f"Domain ID:       {database_result['domain_id']}")
print(f"Scan ID:         {database_result['scan_id']}")
print(f"Domain:          {database_result['domain']}")
print(f"Prediction:      {database_result['prediction']}")
print(f"Risk score:      {database_result['risk_score']}%")
print(
    f"Confidence:      "
    f"{database_result['confidence_score']}"
)

print()
print("==========================================")
print(" TEST COMPLETED")
print("==========================================")