import re
from urllib.parse import urlsplit
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.services.feature_engineering import extract_features
from backend.services.model_service import predict_domain


DOMAIN_LABEL = re.compile(
    r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"
)


def normalise_domain(value: str) -> str:
    raw = value.strip()

    if (
        not raw
        or "@" in raw
        or any(char.isspace() for char in raw)
    ):
        raise ValueError(
            "Enter a valid domain name, such as example.com."
        )

    parsed = urlsplit(
        raw if "://" in raw else f"//{raw}"
    )

    if parsed.scheme and parsed.scheme not in {
        "http",
        "https",
    }:
        raise ValueError(
            "Only website domains are supported."
        )

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
        hostname = (
            parsed.hostname or ""
        ).rstrip(".").lower()
    except ValueError as error:
        raise ValueError(
            "Enter a valid domain name, such as example.com."
        ) from error

    try:
        hostname = (
            hostname.encode("idna")
            .decode("ascii")
        )
    except UnicodeError as error:
        raise ValueError(
            "Invalid international domain name."
        ) from error

    labels = hostname.split(".")

    if (
        len(hostname) > 253
        or len(labels) < 2
        or len(labels[-1]) < 2
        or any(
            not DOMAIN_LABEL.fullmatch(label)
            for label in labels
        )
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
    try:
        domain = normalise_domain(
            domain_input
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    try:
        features = extract_features(
            domain
        )

        result = predict_domain(
            features
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Domain analysis failed: {error}",
        ) from error

    prediction = (
        "Phishing"
        if result["prediction"]
        else "Legitimate"
    )

    risk_score = round(
        float(
            result["phishing_probability"]
        ) * 100,
        2,
    )

    # Find existing domain
    existing = db.execute(
        text(
            """
            SELECT domain_id
            FROM domains
            WHERE domain_name = :domain
            LIMIT 1
            """
        ),
        {
            "domain": domain
        },
    ).first()

    if existing:
        domain_id = existing[0]

    else:
        db.execute(
            text(
                """
                INSERT INTO domains
                    (domain_name)
                VALUES
                    (:domain)
                """
            ),
            {
                "domain": domain
            },
        )

        domain_id = db.execute(
            text(
                """
                SELECT domain_id
                FROM domains
                WHERE domain_name = :domain
                LIMIT 1
                """
            ),
            {
                "domain": domain
            },
        ).scalar()

    # Save scan
    db.execute(
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

    scan_id = db.execute(
        text(
            """
            SELECT scan_id
            FROM scan_results
            WHERE user_id <=> :user_id
              AND domain_id = :domain_id
            ORDER BY scan_id DESC
            LIMIT 1
            """
        ),
        {
            "user_id": user_id,
            "domain_id": domain_id,
        },
    ).scalar()

    # Save features
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
            "domain_age": features.get(
                "domain_age_days"
            ),
            "registration_period": features.get(
                "registration_period_days"
            ),
            "domain_length": features.get(
                "domain_length"
            ),
            "hyphen_count": features.get(
                "num_hyphens"
            ),
            "digit_count": features.get(
                "num_digits"
            ),
            "shannon_entropy": features.get(
                "entropy_domain"
            ),
            "brand_keyword_detection": features.get(
                "brand_keyword"
            ),
            "typosquatting_similarity": features.get(
                "typosquatting_score"
            ),
            "ssl_certificate_age": features.get(
                "ssl_certificate_age_days"
            ),
            "tld": features.get(
                "tld"
            ),
        },
    )

    # Save model output
    try:
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
                "model_name": result.get(
                    "model_name",
                    "XGBoost",
                ),
                "confidence_score": result.get(
                    "phishing_probability",
                    0,
                ),
                "explanation": result.get(
                    "explanation"
                ),
            },
        )

    except Exception:
        pass

    db.commit()

    return {
        "id": scan_id,
        "domain": domain,
        "original": domain_input,
        "source": source,
        "user_id": user_id,
        "prediction": prediction,
        "risk_score": risk_score,
        "scan_time": datetime.now(),
        "model_name": result.get(
            "model_name",
            "XGBoost",
        ),
        "explanation": result.get(
            "explanation"
        ),
        "features": features,
    }


def scan_response(
    scan,
    collection=None,
):
    features = scan.get(
        "features",
        {},
    )

    risk_score = float(
        scan.get(
            "risk_score",
            0,
        )
    )

    return {
        "id": scan["id"],
        "domain": scan["domain"],
        "original": scan.get(
            "original",
            scan["domain"],
        ),
        "source": (
            collection
            if collection
            else scan.get("source")
        ),
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
        "model_name": scan.get(
            "model_name",
            "XGBoost",
        ),
        "explanation": scan.get(
            "explanation"
        ),
        "confidence_score": round(
            max(
                risk_score,
                100 - risk_score,
            ) / 100,
            4,
        ),
        "domain_age": features.get(
            "domain_age_days"
        ),
        "registration_period": features.get(
            "registration_period_days"
        ),
        "domain_length": features.get(
            "domain_length"
        ),
        "hyphens": features.get(
            "num_hyphens"
        ),
        "digits": features.get(
            "num_digits"
        ),
        "shannon_entropy": features.get(
            "entropy_domain"
        ),
        "brand_keyword": features.get(
            "brand_keyword"
        ),
        "typosquatting_similarity": features.get(
            "typosquatting_score"
        ),
        "ssl_cert_age": features.get(
            "ssl_certificate_age_days"
        ),
        "tld": (
            f".{features['tld']}"
            if features.get("tld")
            else ""
        ),
        "features": features,
    }