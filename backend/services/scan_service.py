
"""Validate, analyse, save and format domain scan results."""

import json
import re
from datetime import datetime
from urllib.parse import urlsplit

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.services.feature_engineering import (
    extract_features,
    get_registration_metadata,
)
from backend.services.model_service import predict_domain


DOMAIN_LABEL = re.compile(
    r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"
)


def normalise_domain(value: str) -> str:
    """Validate and normalise a submitted domain."""

    raw = value.strip()

    if not raw or "@" in raw or any(char.isspace() for char in raw):
        raise ValueError(
            "Enter a valid domain name, such as example.com."
        )

    parsed = urlsplit(
        raw if "://" in raw else f"//{raw}"
    )

    if parsed.scheme and parsed.scheme not in {"http", "https"}:
        raise ValueError("Only website domains are supported.")

    try:
        if parsed.port is not None:
            raise ValueError(
                "Enter a domain without a port number."
            )
    except ValueError as error:
        raise ValueError(
            "Enter a domain without a port number."
        ) from error

    try:
        hostname = (parsed.hostname or "").rstrip(".").lower()
    except ValueError as error:
        raise ValueError(
            "Enter a valid domain name, such as example.com."
        ) from error

    try:
        hostname = hostname.encode("idna").decode("ascii")
    except UnicodeError as error:
        raise ValueError(
            "Invalid international domain name."
        ) from error

    labels = hostname.split(".")

    if (
        len(hostname) > 253
        or len(labels) < 2
        or len(labels[-1]) < 2
        or any(not DOMAIN_LABEL.fullmatch(label) for label in labels)
    ):
        raise ValueError(
            "Enter a valid domain name, such as example.com."
        )

    return hostname


def scan_domain(
    db: Session,
    domain_input: str,
    source: str,
    user_id: int | None,
):
    """Analyse a domain and save its scan using the existing MySQL tables."""

    try:
        domain = normalise_domain(domain_input)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    # Extract the existing ten model features using the scan source.
    # Manual scans use WHOIS; automated scans use RDAP.
    try:
        features = extract_features(domain, source=source)

        # The model receives the original ten features only.
        result = predict_domain(features)

        # Registration date is display metadata, not an ML feature.
        # The helper should return a date only for manual .nz scans.
        registration_date = get_registration_metadata(domain, source)

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Domain analysis failed: {error}",
        ) from error

    # Add metadata after prediction so it never enters the model input.
    if registration_date is not None:
        if isinstance(registration_date, datetime):
            registration_date = registration_date.date().isoformat()
        else:
            registration_date = str(registration_date)

        features["registration_date"] = registration_date

    prediction = (
        "Phishing" if result["prediction"] else "Legitimate"
    )

    risk_score = round(
        float(result["phishing_probability"]) * 100,
        2,
    )

    # These are the real numerical contributions calculated by model_service.
    # None means SHAP values were unavailable, not that they were zero.
    shap_values = result.get("shap_values")

    try:
        # Create or reuse the domain row safely under concurrent scans.
        domain_result = db.execute(
            text(
                """
                INSERT INTO domains (domain_name)
                VALUES (:domain)
                ON DUPLICATE KEY UPDATE
                    domain_id = LAST_INSERT_ID(domain_id)
                """
            ),
            {"domain": domain},
        )

        domain_id = domain_result.lastrowid

        if not domain_id:
            raise RuntimeError(
                "Could not identify the domain record."
            )

        # Save this scan and capture its own generated ID.
        scan_result = db.execute(
            text(
                """
                INSERT INTO scan_results
                    (
                        user_id,
                        domain_id,
                        scan_time,
                        prediction_result,
                        risk_score
                    )
                VALUES
                    (
                        :user_id,
                        :domain_id,
                        :scan_time,
                        :prediction_result,
                        :risk_score
                    )
                """
            ),
            {
                "user_id": user_id,
                "domain_id": domain_id,
                "scan_time": datetime.now(),
                "prediction_result": prediction,
                "risk_score": risk_score,
            },
        )

        scan_id = scan_result.lastrowid

        if not scan_id:
            raise RuntimeError(
                "Could not identify the saved scan."
            )

        # Persist the original ten features in the existing schema.
        db.execute(
            text(
                """
                INSERT INTO domain_features
                    (
                        scan_id,
                        domain_age,
                        registration_period,
                        domain_length,
                        hyphen_count,
                        digit_count,
                        shannon_entropy,
                        brand_keyword_detection,
                        typosquatting_similarity,
                        ssl_certificate_age,
                        tld
                    )
                VALUES
                    (
                        :scan_id,
                        :domain_age,
                        :registration_period,
                        :domain_length,
                        :hyphen_count,
                        :digit_count,
                        :shannon_entropy,
                        :brand_keyword_detection,
                        :typosquatting_similarity,
                        :ssl_certificate_age,
                        :tld
                    )
                """
            ),
            {
                "scan_id": scan_id,
                "domain_age": features.get("domain_age_days"),
                "registration_period": features.get(
                    "registration_period_days"
                ),
                "domain_length": features.get("domain_length"),
                "hyphen_count": features.get("num_hyphens"),
                "digit_count": features.get("num_digits"),
                "shannon_entropy": features.get("entropy_domain"),
                "brand_keyword_detection": features.get("brand_keyword"),
                "typosquatting_similarity": features.get(
                    "typosquatting_score"
                ),
                "ssl_certificate_age": features.get(
                    "ssl_certificate_age_days"
                ),
                "tld": features.get("tld"),
            },
        )

        # Preserve the existing model output behaviour.
        db.execute(
            text(
                """
                INSERT INTO model_outputs
                    (
                        scan_id,
                        model_name,
                        confidence_score,
                        explanation
                    )
                VALUES
                    (
                        :scan_id,
                        :model_name,
                        :confidence_score,
                        :explanation
                    )
                """
            ),
            {
                "scan_id": scan_id,
                "model_name": result.get("model_name", "XGBoost"),
                "confidence_score": result.get(
                    "phishing_probability", 0
                ),
                "explanation": result.get("explanation"),
            },
        )

        # Save actual SHAP contributions only when they were calculated.
        # The table was created by the teammate and references scan_results.
        if shap_values is not None:
            if not isinstance(shap_values, dict):
                raise ValueError(
                    "SHAP values must be a feature-to-value dictionary."
                )

            shap_json = json.dumps(shap_values, allow_nan=False)

            db.execute(
                text(
                    """
                    INSERT INTO scan_shap_values
                        (scan_id, shap_values)
                    VALUES
                        (:scan_id, :shap_values)
                    """
                ),
                {
                    "scan_id": scan_id,
                    "shap_values": shap_json,
                },
            )

        # Commit the scan and all associated data together.
        db.commit()

    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Could not save scan result: {error}",
        ) from error

    return {
        "id": scan_id,
        "domain": domain,
        "original": domain_input,
        "source": source,
        "user_id": user_id,
        "prediction": prediction,
        "risk_score": risk_score,
        "scan_time": datetime.now(),
        "model_name": result.get("model_name", "XGBoost"),
        "explanation": result.get("explanation"),
        "shap_values": shap_values,
        "features": features,
    }


def scan_response(scan, collection=None):
    """Format a scan for the frontend."""

    features = scan.get("features") or {}

    risk_score = float(scan.get("risk_score") or 0)

    response = {
        "id": scan["id"],
        "domain": scan["domain"],
        "original": scan.get("original", scan["domain"]),
        "source": collection or scan.get("source"),
        "scan_time": (
            scan["scan_time"].isoformat()
            if scan.get("scan_time")
            else None
        ),
        "prediction": scan["prediction"],
        "risk_score": risk_score,
        "review_status": "Pending",
        "decision": None,
        "note": None,
        "model_name": scan.get("model_name", "XGBoost"),
        "explanation": scan.get("explanation"),
        "shap_values": scan.get("shap_values"),
        "confidence_score": round(
            max(risk_score, 100 - risk_score) / 100,
            4,
        ),
        "domain_age": features.get("domain_age_days"),
        "registration_period": features.get(
            "registration_period_days"
        ),
        "domain_length": features.get("domain_length"),
        "hyphens": features.get("num_hyphens"),
        "digits": features.get("num_digits"),
        "shannon_entropy": features.get("entropy_domain"),
        "brand_keyword": features.get("brand_keyword"),
        "typosquatting_similarity": features.get(
            "typosquatting_score"
        ),
        "ssl_cert_age": features.get("ssl_certificate_age_days"),
        "tld": (
            f".{features['tld']}"
            if features.get("tld")
            else ""
        ),
        "features": features,
    }

    # Return registration date only when feature engineering supplied it.
    # This keeps it separate from the original ten model features.
    if features.get("registration_date") is not None:
        response["registration_date"] = features["registration_date"]

    return response
