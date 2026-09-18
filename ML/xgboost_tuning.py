import pandas as pd
from pathlib import Path

from sklearn.model_selection import train_test_split, GridSearchCV
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

# LOAD DATASET

print("\n==========================================")
print(" THREAT HUNTER - XGBOOST HYPERPARAMETER TUNING")
print("==========================================\n")

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

X = df[numeric_features + categorical_features]
y = df["label"].astype(int)

# TRAIN / TEST SPLIT

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\nTraining records:", len(X_train))
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
        OneHotEncoder(handle_unknown="ignore")
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


# BASE XGBOOST MODEL

xgb_model = XGBClassifier(
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
        xgb_model
    )
])

# HYPERPARAMETER GRID

param_grid = {
    "model__n_estimators": [100, 200, 300],
    "model__max_depth": [3, 6, 9],
    "model__learning_rate": [0.03, 0.05, 0.1],
    "model__subsample": [0.8, 0.9, 1.0],
    "model__colsample_bytree": [0.8, 0.9, 1.0]
}

# GRID SEARCH

print("\n==========================================")
print(" STARTING 5-FOLD CROSS-VALIDATION")
print("==========================================")

print("\nParameter combinations:")
print("3 × 3 × 3 × 3 × 3 = 243 combinations")

grid_search = GridSearchCV(
    estimator=pipeline,
    param_grid=param_grid,
    scoring="f1",
    cv=5,
    n_jobs=-1,
    verbose=1
)

grid_search.fit(
    X_train,
    y_train
)


# BEST PARAMETERS

print("\n==========================================")
print(" BEST PARAMETERS")
print("==========================================")

print(grid_search.best_params_)
print(
    f"\nBest Cross-Validation F1: "
    f"{grid_search.best_score_:.4f}"
)


# TEST BEST MODEL

best_model = grid_search.best_estimator_

predictions = best_model.predict(X_test)
probabilities = best_model.predict_proba(X_test)[:, 1]

accuracy = accuracy_score(
    y_test,
    predictions
)

roc_auc = roc_auc_score(
    y_test,
    probabilities
)


# RESULTS

print("\n==========================================")
print(" TUNED XGBOOST TEST RESULTS")
print("==========================================")

print(
    f"Accuracy : {accuracy:.4f} "
    f"({accuracy * 100:.2f}%)"
)

print(
    f"ROC-AUC  : {roc_auc:.4f}"
)

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        predictions,
        digits=4
    )
)

print("Confusion Matrix:")
print(
    confusion_matrix(
        y_test,
        predictions
    )
)

# COMPARISON WITH FINAL BASELINee

print("\n==========================================")
print(" BASELINE VS TUNED")
print("==========================================")

print("Baseline XGBoost Accuracy: 90.00%")
print(
    f"Tuned XGBoost Accuracy:    "
    f"{accuracy * 100:.2f}%"
)

difference = (accuracy * 100) - 90.00

print(
    f"Difference: {difference:+.2f} percentage points"
)


# SAVE TUNED MODEL

output_model = Path(
    r"C:\Users\johal\Threat_Hunters\ML\xgboost_tuned_model.json"
)

best_model.named_steps["model"].save_model(
    output_model
)

print(
    f"\nTuned model saved to: {output_model}"
)

print("\n==========================================")
print(" TUNING COMPLETED")
print("==========================================")