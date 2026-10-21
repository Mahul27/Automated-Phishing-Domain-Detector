"""Keep the analyst's verdict separate from the model's review outcome."""


def normalise_review_decision(decision: str | None) -> str | None:
    # Older clients used this label for every "Not phishing" review.
    if decision == "False Positive":
        return "Confirmed Legitimate"
    return decision


def review_fields(prediction, decision, review_status):
    decision = normalise_review_decision(decision)
    outcome = None
    if review_status == "Completed":
        outcome = {
            ("Phishing", "Confirmed Phishing"): "True Positive",
            ("Phishing", "Confirmed Legitimate"): "False Positive",
            ("Legitimate", "Confirmed Phishing"): "False Negative",
            ("Legitimate", "Confirmed Legitimate"): "True Negative",
        }.get((prediction, decision))
    return {"decision": decision, "model_outcome": outcome}
