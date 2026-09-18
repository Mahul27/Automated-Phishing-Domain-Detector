import pandas as pd
from pathlib import Path

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score
)

from xgboost import XGBClassifier


# FILE PATH

input_file = Path(
    r"C:\Users\johal\Threat_Hunters\Dataset\ML_Final_10_Features_Cleaned.csv"
)

output_model = Path(
    r"C:\Users\johal\Threat_Hunters\ML\final_xgboost_model.json"
)

output_predictions = Path(
    r"C:\Users\johal\Threat_Hunters\ML\final_xgboost_predictions.csv"
)


# LOAD DATASET

print("\n==========================================")
print(" THREAT HUNTER - FINAL XGBOOST MODEL")
print("==========================================\n")

print("Loading dataset...")

df = pd.read_csv(input_file)

print("Dataset loaded successfully.")
print("Total records:", len(df))


# FINAL 10 FEATURES

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


# INPUT (X) AND TARGET (Y)

X = df[
    numeric_features + categorical_features
]

y = df["label"].astype(int)

print("\nFeatures used:")

for feature in numeric_features + categorical_features:
    print("-", feature)

print("\nTarget variable: label")

# TRAIN / TEST SPLIT

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\n==========================================")
print(" TRAIN / TEST SPLIT")
print("==========================================")

print("Training records:", len(X_train))
print("Testing records:", len(X_test))


# PREPROCESSING

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

# FINAL XGBOOST MODEL

model = XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.9,
    colsample_bytree=0.9,
    eval_metric="logloss",
    random_state=42,
    n_jobs=-1
)


# PIPELINE

pipeline = Pipeline([
    (
        "preprocessing",
        preprocessor
    ),
    (
        "model",
        model
    )
])

# TRAIN

print("\n==========================================")
print(" TRAINING XGBOOST")
print("==========================================")

print("Training model...")

pipeline.fit(
    X_train,
    y_train
)


# PREDICTIONS

print("Making predictions...")

predictions = pipeline.predict(
    X_test
)

probabilities = pipeline.predict_proba(
    X_test
)[:, 1]

# EVALUATION

accuracy = accuracy_score(
    y_test,
    predictions
)

roc_auc = roc_auc_score(
    y_test,
    probabilities
)

report = classification_report(
    y_test,
    predictions,
    digits=4
)

matrix = confusion_matrix(
    y_test,
    predictions
)

# DISPLAY RESULTS

print("\n==========================================")
print(" FINAL XGBOOST RESULTS")
print("==========================================")

print("\nAccuracy:")
print(f"{accuracy:.4f}")

print(
    f"Percentage: {accuracy * 100:.2f}%"
)

print("\nROC-AUC:")
print(f"{roc_auc:.4f}")

print("\nClassification Report:")
print(report)

print("Confusion Matrix:")
print(matrix)

# SAVE PREDICTIONS

prediction_results = X_test.copy()

prediction_results["actual_label"] = y_test.values
prediction_results["predicted_label"] = predictions
prediction_results["prediction_probability"] = probabilities

prediction_results.to_csv(
    output_predictions,
    index=False
)

print(
    f"\nPredictions saved to: {output_predictions}"
)
# SAVE MODEL

pipeline.named_steps["model"].save_model(
    output_model
)

print(
    f"XGBoost model saved to: {output_model}"
)


# COMPLETED

print("\n==========================================")
print(" XGBOOST COMPLETED")
print("==========================================")