
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

DATASET_FILE = next(
    (path for path in DATASET_CANDIDATES if path.is_file()),
    DATASET_CANDIDATES[0],
)

MODEL_FILE = BACKEND_ROOT / "models" / "final_xgboost_model.json"


@lru_cache(maxsize=1)
def _load_model():
    if not DATASET_FILE.is_file():
        return (
            None,
            None,
            "Training CSV missing: Dataset/ML_Final_10_Features_Cleaned.csv",
        )

    if not MODEL_FILE.is_file():
        return (
            None,
            None,
            "XGBoost model missing: backend/models/final_xgboost_model.json",
        )

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
            raise ValueError(
                f"Training CSV lacks columns: {', '.join(sorted(missing))}"
            )

        features = frame[FEATURE_NAMES]
        labels = frame["label"].astype(int)

        training, _, training_labels, _ = train_test_split(
            features,
            labels,
            test_size=0.20,
            random_state=42,
            stratify=labels,
        )

        preprocessor = ColumnTransformer(
            [
                (
                    "numeric",
                    Pipeline(
                        [
                            ("imputer", SimpleImputer(strategy="median")),
                        ]
                    ),
                    FEATURE_NAMES[:-1],
                ),
                (
                    "tld",
                    Pipeline(
                        [
                            (
                                "imputer",
                                SimpleImputer(strategy="most_frequent"),
                            ),
                            (
                                "onehot",
                                OneHotEncoder(handle_unknown="ignore"),
                            ),
                        ]
                    ),
                    ["tld"],
                ),
            ]
        )

        preprocessor.fit(training, training_labels)

        model = XGBClassifier()
        model.load_model(MODEL_FILE)

        if (
            preprocessor.transform(training.head(1)).shape[1]
            != model.n_features_in_
        ):
            raise ValueError(
                "Training CSV TLD columns do not match the saved model."
            )

        return preprocessor, model, None

    except Exception as error:
        # A broken training file must not prevent the API or live feed from starting.
        return None, None, f"XGBoost unavailable: {error}"


def model_status():
    _, model, reason = _load_model()

    return {
        "mode": "xgboost" if model else "heuristic",
        "reason": reason,
    }


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
        "explanation": (
            ", ".join(reasons)
            if reasons
            else "No strong risk signals in available features."
        ),
        # The heuristic fallback does not calculate SHAP values.
        "shap_values": None,
    }


def _calculate_shap_values(preprocessor, model, transformed):
    """Return actual SHAP contributions grouped by original feature name.

    Positive values increase the model's phishing log-odds.
    Negative values decrease the model's phishing log-odds.

    These are model contributions, not independent risk classifications.
    """
    from xgboost import DMatrix

    values = model.get_booster().predict(
        DMatrix(transformed),
        pred_contribs=True,
    )[0]

    names = preprocessor.get_feature_names_out()

    # XGBoost includes one additional value for the model's base contribution.
    if len(values) != len(names) + 1:
        raise ValueError(
            "SHAP columns do not match the fitted preprocessor."
        )

    grouped = {}

    for name, value in zip(names, values[:-1]):
        label = name.split("__", 1)[-1]

        # Group all one-hot encoded TLD columns under the original TLD feature.
        if label.startswith("tld_"):
            label = "tld"

        grouped[label] = grouped.get(label, 0.0) + float(value)

    # Return the original ten feature names in their established order.
    return {
        name: float(grouped.get(name, 0.0))
        for name in FEATURE_NAMES
    }


def _xgboost_explanation(shap_values):
    """Convert real SHAP contributions into an explanation for everyday users."""

    feature_explanations = {
        "domain_age_days": (
            "The domain's registration age influenced the assessment. "
            "Newly registered domains can deserve closer inspection."
        ),
        "registration_period_days": (
            "The domain's registration period influenced the assessment. "
            "Registration length alone cannot determine whether a website is safe."
        ),
        "domain_length": (
            "The length of the website address influenced the assessment. "
            "Unusually long addresses can sometimes deserve a closer look."
        ),
        "num_hyphens": (
            "The number of hyphens in the website address influenced the assessment. "
            "Hyphens are not dangerous by themselves, but unusual patterns "
            "can deserve investigation."
        ),
        "num_digits": (
            "The numbers in the website address influenced the assessment. "
            "Numbers alone do not mean a website is malicious."
        ),
        "entropy_domain": (
            "The character pattern of the website address influenced the assessment. "
            "Unusual patterns can sometimes deserve further investigation."
        ),
        "brand_keyword": (
            "The presence of a name associated with a known brand influenced "
            "the assessment. The address should be checked to see whether "
            "it genuinely belongs to that brand."
        ),
        "typosquatting_score": (
            "The similarity between this address and a known brand influenced "
            "the assessment. Similarity can indicate an attempt to imitate a "
            "brand, but it is not proof of phishing."
        ),
        "ssl_certificate_age_days": (
            "The age of the website's security certificate influenced the assessment. "
            "A recently issued certificate does not automatically mean "
            "a website is dangerous."
        ),
        "tld": (
            "The website's domain ending influenced the assessment. "
            "A domain ending alone cannot prove that a website is malicious."
        ),
    }

    strongest = sorted(
        shap_values.items(),
        key=lambda item: abs(item[1]),
        reverse=True,
    )[:3]

    descriptions = []

    for name, value in strongest:
        if abs(value) <= 1e-9:
            continue

        direction = (
            "increased the model's phishing risk estimate"
            if value > 0
            else "decreased the model's phishing risk estimate"
        )

        explanation = feature_explanations.get(
            name,
            "This characteristic influenced the model's assessment.",
        )

        descriptions.append(
            f"{explanation} In this assessment, it {direction}."
        )

    if not descriptions:
        return (
            "The model produced a prediction, but no individual feature "
            "had a measurable contribution to explain."
        )

    return " ".join(descriptions)


def predict_domain(features):
    missing = set(FEATURE_NAMES) - set(features)

    if missing:
        raise ValueError(
            f"Missing features: {', '.join(sorted(missing))}"
        )

    preprocessor, model, _ = _load_model()

    if model is None:
        return _heuristic(features)

    import pandas as pd

    row = pd.DataFrame(
        [
            {name: features[name] for name in FEATURE_NAMES}
        ]
    )

    transformed = preprocessor.transform(row)

    probability = float(
        model.predict_proba(transformed)[0][1]
    )

    shap_values = None

    try:
        shap_values = _calculate_shap_values(
            preprocessor,
            model,
            transformed,
        )

        explanation = _xgboost_explanation(shap_values)

    except Exception as error:
        # A SHAP problem must not discard a valid model prediction.
        explanation = (
            "XGBoost prediction available; "
            f"SHAP explanation unavailable: {error}"
        )

    return {
        "prediction": int(model.predict(transformed)[0]),
        "legitimate_probability": 1 - probability,
        "phishing_probability": probability,
        "model_name": "XGBoost",
        "explanation": explanation,
        # Contains actual grouped contributions, or None if SHAP failed.
        "shap_values": shap_values,
    }
