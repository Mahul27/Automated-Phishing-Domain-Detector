import joblib
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_FILE = BASE_DIR.parent / "ML" / "phishing_domain_model.pk1"

print("\n==========================================")
print(" TEAMMATE XGBOOST MODEL INSPECTION")
print("==========================================\n")

print(f"Loading model from:")
print(MODEL_FILE)

model = joblib.load(MODEL_FILE)

print("\nModel type:")
print(type(model).__name__)

print("\nNumber of input features:")
print(model.n_features_in_)

print("\nFeature names expected by model:")

if hasattr(model, "feature_names_in_"):
    for i, feature in enumerate(model.feature_names_in_, start=1):
        print(f"{i}. {feature}")
else:
    print("Model does not contain feature_names_in_.")

print("\nModel parameters:")

params = model.get_params()

important_params = [
    "n_estimators",
    "max_depth",
    "learning_rate",
    "subsample",
    "colsample_bytree",
    "random_state",
    "enable_categorical"
]

for parameter in important_params:
    print(f"{parameter}: {params.get(parameter)}")

print("\n==========================================")
print(" INSPECTION COMPLETE")
print("==========================================")