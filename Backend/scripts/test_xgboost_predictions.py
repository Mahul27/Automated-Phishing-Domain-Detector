import pandas as pd
from pathlib import Path

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

CANDIDATE_FILE = (
    BASE_DIR
    / "opensquat"
    / "candidate_features_test_10.csv"
)

MODEL_FILE = (
    BASE_DIR.parent
    / "ML"
    / "final_xgboost_model.json"
)


# ============================================================
# FEATURES
# ============================================================

numeric_features = [
    "domain_age_days",
    "registration_period_days",
    "domain_length",
    "num_hyphens",
    "num_digits",
    "entropy_domain",
    "brand_keyword",
    "typosquatting_score",
    "ssl_certificate_age_days"
]

categorical_features = [
    "tld"
]


# ============================================================
# LOAD TRAINING DATASET
# ============================================================

print("\n==========================================")
print(" THREAT HUNTER - XGBOOST PREDICTION TEST")
print("==========================================\n")

print("Loading training dataset...")

df = pd.read_csv(DATASET_FILE)

print("Training records:", len(df))


X = df[numeric_features + categorical_features]
y = df["label"].astype(int)


# ============================================================
# RECREATE THE SAME TRAIN/TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
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
    )
])


preprocessor = ColumnTransformer([
    (
        "numeric",
        numeric_pipeline,
        numeric_features
    ),
    (
        "tld",
        tld_pipeline,
        categorical_features
    )
])


print("Fitting preprocessing using training data...")

preprocessor.fit(X_train, y_train)


# ============================================================
# LOAD XGBOOST MODEL
# ============================================================

print("Loading XGBoost model...")

model = XGBClassifier()

model.load_model(MODEL_FILE)

print("Model loaded successfully.")


# ============================================================
# LOAD CANDIDATE FEATURES
# ============================================================

print("\nLoading candidate feature file...")

candidates = pd.read_csv(CANDIDATE_FILE)

print("Candidate domains:", len(candidates))


# ============================================================
# CHECK REQUIRED FEATURES
# ============================================================

required_columns = [
    "domain"
] + numeric_features + categorical_features

missing_columns = [
    column
    for column in required_columns
    if column not in candidates.columns
]

if missing_columns:
    print("\nERROR: Missing columns:")
    for column in missing_columns:
        print("-", column)

    raise SystemExit(1)


# ============================================================
# PREPARE CANDIDATE DATA
# ============================================================

candidate_X = candidates[
    numeric_features + categorical_features
].copy()


# ============================================================
# TRANSFORM FEATURES
# ============================================================

print("Applying model preprocessing...")

candidate_transformed = preprocessor.transform(
    candidate_X
)


print(
    "Transformed feature count:",
    candidate_transformed.shape[1]
)


# ============================================================
# PREDICT
# ============================================================

print("\nRunning XGBoost predictions...")

predictions = model.predict(
    candidate_transformed
)

probabilities = model.predict_proba(
    candidate_transformed
)


# ============================================================
# ADD RESULTS
# ============================================================

candidates["prediction"] = predictions.astype(int)

candidates["legitimate_probability"] = probabilities[:, 0]

candidates["phishing_probability"] = probabilities[:, 1]


# ============================================================
# SAVE RESULTS
# ============================================================

output_file = (
    BASE_DIR
    / "opensquat"
    / "candidate_predictions_test_10.csv"
)

candidates.to_csv(
    output_file,
    index=False
)


# ============================================================
# DISPLAY RESULTS
# ============================================================

print("\n==========================================")
print(" PREDICTION RESULTS")
print("==========================================\n")

for _, row in candidates.iterrows():

    print(
        f"{row['domain']}"
    )

    print(
        f"  Prediction: {int(row['prediction'])}"
    )

    print(
        f"  Legitimate probability: "
        f"{row['legitimate_probability']:.4f}"
    )

    print(
        f"  Phishing probability: "
        f"{row['phishing_probability']:.4f}"
    )

    print()


print("==========================================")
print(" COMPLETED")
print("==========================================")

print("\nSaved:")
print(output_file)