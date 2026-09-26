from sqlalchemy import text

from database.database import SessionLocal


def save_scan_result(
    domain,
    features,
    prediction,
    legitimate_probability,
    phishing_probability,
    user_id=None
):
    """
    Save one scan and its related data into MySQL.

    Automated scans use user_id=None.
    Manual scans can provide the logged-in user's ID.
    """

    db = SessionLocal()

    try:

        # ====================================================
        # 1. FIND OR CREATE DOMAIN
        # ====================================================

        domain_result = db.execute(
            text("""
                SELECT domain_id
                FROM domains
                WHERE domain_name = :domain_name
            """),
            {
                "domain_name": domain
            }
        ).first()

        if domain_result:

            domain_id = domain_result[0]

        else:

            db.execute(
                text("""
                    INSERT INTO domains (domain_name)
                    VALUES (:domain_name)
                """),
                {
                    "domain_name": domain
                }
            )

            domain_id = db.execute(
                text("""
                    SELECT domain_id
                    FROM domains
                    WHERE domain_name = :domain_name
                """),
                {
                    "domain_name": domain
                }
            ).scalar_one()


        # ====================================================
        # 2. SAVE SCAN RESULT
        # ====================================================

        prediction_result = (
            "phishing"
            if prediction == 1
            else "legitimate"
        )

        risk_score = phishing_probability * 100

        scan_result = db.execute(
            text("""
                INSERT INTO scan_results (
                    user_id,
                    domain_id,
                    prediction_result,
                    risk_score
                )
                VALUES (
                    :user_id,
                    :domain_id,
                    :prediction_result,
                    :risk_score
                )
            """),
            {
                "user_id": user_id,
                "domain_id": domain_id,
                "prediction_result": prediction_result,
                "risk_score": risk_score
            }
        )

        # Get the newly created scan_id
        scan_id = db.execute(
            text("""
                SELECT LAST_INSERT_ID()
            """)
        ).scalar_one()


        # ====================================================
        # 3. SAVE FEATURES
        # ====================================================

        db.execute(
            text("""
                INSERT INTO domain_features (
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
                VALUES (
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
            """),
            {
                "scan_id": scan_id,
                "domain_age": features["domain_age_days"],
                "registration_period": features["registration_period_days"],
                "domain_length": features["domain_length"],
                "hyphen_count": features["num_hyphens"],
                "digit_count": features["num_digits"],
                "shannon_entropy": features["entropy_domain"],
                "brand_keyword_detection": features["brand_keyword"],
                "typosquatting_similarity": features["typosquatting_score"],
                "ssl_certificate_age": features["ssl_certificate_age_days"],
                "tld": features["tld"]
            }
        )


        # ====================================================
        # 4. SAVE MODEL OUTPUT
        # ====================================================

        confidence_score = max(
            legitimate_probability,
            phishing_probability
        )

        db.execute(
            text("""
                INSERT INTO model_outputs (
                    scan_id,
                    model_name,
                    confidence_score,
                    explanation
                )
                VALUES (
                    :scan_id,
                    :model_name,
                    :confidence_score,
                    :explanation
                )
            """),
            {
                "scan_id": scan_id,
                "model_name": "XGBoost",
                "confidence_score": confidence_score,
                "explanation": None
            }
        )


        # ====================================================
        # 5. COMMIT EVERYTHING
        # ====================================================

        db.commit()

        return {
            "scan_id": scan_id,
            "domain_id": domain_id,
            "domain": domain,
            "prediction": prediction_result,
            "risk_score": round(risk_score, 2),
            "confidence_score": round(
                confidence_score,
                4
            )
        }


    except Exception:

        db.rollback()
        raise


    finally:

        db.close()