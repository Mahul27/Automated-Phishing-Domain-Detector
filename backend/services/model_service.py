"""Kartar's XGBoost inference, with an explicitly labelled local fallback.

The JSON model does not contain the fitted TLD encoder. Kartar's training CSV
is needed to recreate that encoder in exactly the original column order.
"""

from functools import lru_cache
from pathlib import Path

from backend.config import BACKEND_ROOT, PROJECT_ROOT


FEATURE_NAMES = [
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
]
DATASET_NAME = "ML_Final_10_Features_Cleaned.csv"
DATASET_CANDIDATES = [
    PROJECT_ROOT / "Dataset" / DATASET_NAME,
    PROJECT_ROOT / "branch-downloads" / "Kartar-22401715" / "Dataset" / DATASET_NAME,
]
DATASET_FILE = next((path for path in DATASET_CANDIDATES if path.is_file()), DATASET_CANDIDATES[0])
MODEL_FILE = BACKEND_ROOT / "models" / "final_xgboost_model.json"


@lru_cache(maxsize=1)
def _load_model():
    if not DATASET_FILE.is_file():
        return None, None, "Training CSV missing: Dataset/ML_Final_10_Features_Cleaned.csv"
    if not MODEL_FILE.is_file():
        return None, None, "XGBoost model missing: backend/models/final_xgboost_model.json"

    try:
        import pandas as pd
        from sklearn.compose import ColumnTransformer
        from sklearn.impute import SimpleImputer
        from sklearn.model_selection import train_test_split
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import OneHotEncoder
        from xgboost import XGBClassifier

        frame = pd.read_csv(DATASET_FILE)
        missing = set(FEATURE_NAMES + ["label"]) - set(frame.columns)
        if missing:
            raise ValueError(f"Training CSV lacks columns: {', '.join(sorted(missing))}")
        features = frame[FEATURE_NAMES]
        labels = frame["label"].astype(int)
        training, _, training_labels, _ = train_test_split(
            features, labels, test_size=0.20, random_state=42, stratify=labels
        )
        preprocessor = ColumnTransformer(
            [
                ("numeric", Pipeline([("imputer", SimpleImputer(strategy="median"))]), FEATURE_NAMES[:-1]),
                (
                    "tld",
                    Pipeline(
                        [
                            ("imputer", SimpleImputer(strategy="most_frequent")),
                            ("onehot", OneHotEncoder(handle_unknown="ignore")),
                        ]
                    ),
                    ["tld"],
                ),
            ]
        )
        preprocessor.fit(training, training_labels)
        model = XGBClassifier()
        model.load_model(MODEL_FILE)
        if preprocessor.transform(training.head(1)).shape[1] != model.n_features_in_:
            raise ValueError("Training CSV TLD columns do not match the saved model.")
        return preprocessor, model, None
    except Exception as error:
        # A broken training file must not prevent the API or live feed from starting.
        return None, None, f"XGBoost unavailable: {error}"


def model_status():
    _, model, reason = _load_model()
    return {"mode": "xgboost" if model else "heuristic", "reason": reason}


def _number(value, default=0.0):
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _heuristic(features):
    """Explainable demo score while the original training CSV is unavailable."""
    score = 10
    reasons = []

    def add(points, reason):
        nonlocal score
        score += points
        reasons.append(reason)

    age = features.get("domain_age_days")
    if age is not None and _number(age) <= 30:
        add(20, "recent domain registration")
    if _number(features.get("brand_keyword")) > 0:
        add(20, "brand keyword")
    if _number(features.get("typosquatting_score")) >= 0.75:
        add(20, "similarity to a known brand")
    if _number(features.get("num_hyphens")) >= 2:
        add(10, "multiple hyphens")
    if _number(features.get("num_digits")) >= 2:
        add(10, "multiple digits")
    if _number(features.get("domain_length")) > 25:
        add(10, "long domain name")
    if str(features.get("tld") or "").lower() in {"xyz", "top", "info"}:
        add(10, "TLD worth reviewing")

    probability = min(score, 95) / 100
    return {
        "prediction": int(probability >= 0.5),
        "legitimate_probability": 1 - probability,
        "phishing_probability": probability,
        "model_name": "Heuristic (training dataset missing)",
        "explanation": ", ".join(reasons) if reasons else "No strong risk signals in available features.",
    }


def _xgboost_explanation(preprocessor, model, transformed):
    """Explain one prediction using XGBoost's built-in SHAP contributions.

    Positive contributions raise the phishing log-odds; negative ones lower it.
    The fitted preprocessor supplies the names for the model's input columns.
    """
    from xgboost import DMatrix

    values = model.get_booster().predict(DMatrix(transformed), pred_contribs=True)[0]
    names = preprocessor.get_feature_names_out()
    if len(values) != len(names) + 1:
        raise ValueError("SHAP columns do not match the fitted preprocessor.")

    # Several one-hot columns represent the same original TLD feature.
    grouped = {}
    for name, value in zip(names, values[:-1]):
        label = name.split("__", 1)[-1]
        if label.startswith("tld_"):
            label = "tld"
        grouped[label] = grouped.get(label, 0.0) + float(value)

    strongest = sorted(grouped.items(), key=lambda item: abs(item[1]), reverse=True)[:3]
    descriptions = [
        f"{name} {'raised' if value > 0 else 'lowered'} the phishing score"
        for name, value in strongest
        if abs(value) > 1e-9
    ]
    if not descriptions:
        return "XGBoost SHAP: no individual feature had a measurable effect."
    return "XGBoost SHAP (model contributions): " + "; ".join(descriptions) + "."


def predict_domain(features):
    missing = set(FEATURE_NAMES) - set(features)
    if missing:
        raise ValueError(f"Missing features: {', '.join(sorted(missing))}")
    preprocessor, model, _ = _load_model()
    if model is None:
        return _heuristic(features)

    import pandas as pd

    row = pd.DataFrame([{name: features[name] for name in FEATURE_NAMES}])
    transformed = preprocessor.transform(row)
    probability = float(model.predict_proba(transformed)[0][1])
    try:
        explanation = _xgboost_explanation(preprocessor, model, transformed)
    except Exception as error:
        # An explanation problem must not discard a valid model prediction.
        explanation = f"XGBoost prediction available; SHAP explanation unavailable: {error}"
    return {
        "prediction": int(model.predict(transformed)[0]),
        "legitimate_probability": 1 - probability,
        "phishing_probability": probability,
        "model_name": "XGBoost",
        "explanation": explanation,
    }
