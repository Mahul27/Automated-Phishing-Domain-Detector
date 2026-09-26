from pathlib import Path

import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder

from xgboost import XGBClassifier


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATASET_FILE = (
    BASE_DIR.parent
    / "Dataset"
    / "ML_Final_10_Features_Cleaned.csv"
)

MODEL_FILE = (
    BASE_DIR.parent
    / "ML"
    / "final_xgboost_model.json"
)


# ============================================================
# FEATURES
# ============================================================

NUMERIC_FEATURES = [
    "domain_age_days",
    "registration_period_days",
    "domain_length",
    "num_hyphens",
    "num_digits",
    "entropy_domain",
    "brand_keyword",
    "typosquatting_score",
    "ssl_certificate_age_days",
]

CATEGORICAL_FEATURES = [
    "tld",
]


# ============================================================
# LOAD TRAINING DATA
# ============================================================

df = pd.read_csv(DATASET_FILE)

X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
y = df["label"].astype(int)


# ============================================================
# RECREATE THE SAME TRAIN / TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y,
)


# ============================================================
# RECREATE THE SAME PREPROCESSING
# ============================================================

numeric_pipeline = Pipeline([
    (
        "imputer",
        SimpleImputer(strategy="median")
    )
])


tld_pipeline = Pipeline([
    (
        "imputer",
        SimpleImputer(strategy="most_frequent")
    ),
    (
        "onehot",
        OneHotEncoder(
            handle_unknown="ignore"
        )
    ),
])


preprocessor = ColumnTransformer([
    (
        "numeric",
        numeric_pipeline,
        NUMERIC_FEATURES
    ),
    (
        "tld",
        tld_pipeline,
        CATEGORICAL_FEATURES
    ),
])


# Fit preprocessing exactly as in the working prediction test
preprocessor.fit(X_train, y_train)


# ============================================================
# LOAD XGBOOST MODEL
# ============================================================

model = XGBClassifier()

model.load_model(MODEL_FILE)


# ============================================================
# PREDICTION FUNCTION
# ============================================================

def predict_domain(features: dict) -> dict:
    """
    Predict phishing probability for one domain.

    Input:
        Dictionary containing the final 10 project features.

    Returns:
        Prediction and probabilities.
    """

    required_features = (
        NUMERIC_FEATURES +
        CATEGORICAL_FEATURES
    )

    missing_features = [
        feature
        for feature in required_features
        if feature not in features
    ]

    if missing_features:
        raise ValueError(
            f"Missing required features: {missing_features}"
        )

    # Create one-row DataFrame
    candidate_df = pd.DataFrame([
        {
            feature: features[feature]
            for feature in required_features
        }
    ])

    # Apply the same preprocessing
    transformed_features = preprocessor.transform(
        candidate_df
    )

    # Prediction
    prediction = int(
        model.predict(transformed_features)[0]
    )

    probabilities = model.predict_proba(
        transformed_features
    )[0]

    legitimate_probability = float(
        probabilities[0]
    )

    phishing_probability = float(
        probabilities[1]
    )

    return {
        "prediction": prediction,
        "legitimate_probability": legitimate_probability,
        "phishing_probability": phishing_probability,
    }


# ============================================================
# LOCAL TEST
# ============================================================

if __name__ == "__main__":

    print()
    print("==========================================")
    print(" THREAT HUNTER - MODEL SERVICE TEST")
    print("==========================================")
    print()

    test_features = {
        "domain_age_days": 2,
        "registration_period_days": 731,
        "domain_length": 9,
        "num_hyphens": 0,
        "num_digits": 1,
        "entropy_domain": 2.725480556997868,
        "brand_keyword": 1,
        "typosquatting_score": 1.0,
        "ssl_certificate_age_days": None,
        "tld": "com",
    }

    result = predict_domain(test_features)

    print("Prediction:", result["prediction"])
    print(
        "Legitimate probability:",
        f"{result['legitimate_probability']:.6f}"
    )
    print(
        "Phishing probability:",
        f"{result['phishing_probability']:.6f}"
    )

    print()
    print("==========================================")
    print(" TEST COMPLETED")
    print("==========================================")