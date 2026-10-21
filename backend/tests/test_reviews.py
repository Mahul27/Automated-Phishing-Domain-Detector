"""Exercise review saving and both read routes without external services."""

import sqlite3
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from backend.auth import CurrentUser, get_current_user
from backend.database import get_db
from backend.main import app
from backend.services.review_service import review_fields


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={
                "check_same_thread": False,
                "detect_types": sqlite3.PARSE_DECLTYPES,
            },
            poolclass=StaticPool,
        )
        self.addCleanup(self.engine.dispose)
        self.db = Session(self.engine)
        self.addCleanup(self.db.close)
        # Only the columns used by the review routes are needed here.
        tables = {
            "app_users": "user_id INTEGER PRIMARY KEY, supabase_user_id TEXT",
            "domains": "domain_id INTEGER PRIMARY KEY, domain_name TEXT",
            "scan_results": """
                scan_id INTEGER PRIMARY KEY, user_id INTEGER, domain_id INTEGER,
                scan_time TIMESTAMP, prediction_result TEXT, risk_score REAL,
                review_status TEXT, analyst_decision TEXT, analyst_note TEXT,
                reviewed_at TIMESTAMP
            """,
            "domain_features": """
                scan_id INTEGER, domain_age INTEGER, registration_period INTEGER,
                domain_length INTEGER, hyphen_count INTEGER, digit_count INTEGER,
                shannon_entropy REAL, brand_keyword_detection INTEGER,
                typosquatting_similarity REAL, ssl_certificate_age INTEGER, tld TEXT
            """,
            "model_outputs": """
                scan_id INTEGER, output_id INTEGER, model_name TEXT,
                confidence_score REAL, explanation TEXT
            """,
            "scan_shap_values": "scan_id INTEGER, shap_values TEXT",
        }
        for name, columns in tables.items():
            self.db.execute(text(f"CREATE TABLE {name} ({columns})"))
        self.db.execute(text(
            "INSERT INTO app_users VALUES (1, 'review-test-user')"
        ))
        self.db.commit()

        previous_overrides = app.dependency_overrides.copy()
        self.addCleanup(setattr, app, "dependency_overrides", previous_overrides)
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="review-test-user", email="analyst@example.test",
        )
        # No lifespan context: the real MySQL startup must not run in this test.
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def add_scan(self, scan_id, prediction, risk_score=18.65, user_id=None,
                 decision=None, status="Pending"):
        self.db.execute(text(
            "INSERT INTO domains VALUES (:id, :domain)"
        ), {"id": scan_id, "domain": f"review-{scan_id}.example.test"})
        self.db.execute(text("""
            INSERT INTO scan_results (
                scan_id, domain_id, user_id, prediction_result, risk_score,
                review_status, analyst_decision
            ) VALUES (:id, :id, :user_id, :prediction, :risk, :status, :decision)
        """), {
            "id": scan_id, "user_id": user_id, "prediction": prediction,
            "risk": risk_score, "status": status, "decision": decision,
        })
        self.db.commit()

    def listed_scan(self, scan_id, collection):
        response = self.client.get("/api/v1/scans", params={"collection": collection})
        self.assertEqual(response.status_code, 200, response.text)
        return next(row for row in response.json()["records"] if row["id"] == scan_id)

    def test_all_four_outcomes_survive_save_and_both_read_routes(self):
        cases = (
            ("Phishing", "Confirmed Phishing", "True Positive"),
            ("Phishing", "Confirmed Legitimate", "False Positive"),
            ("Legitimate", "Confirmed Phishing", "False Negative"),
            ("Legitimate", "Confirmed Legitimate", "True Negative"),
        )
        for user_id, collection in ((None, "live"), (1, "personal")):
            for prediction, decision, expected in cases:
                with self.subTest(collection=collection, outcome=expected):
                    scan_id = (10 if user_id is None else 20) + cases.index(
                        (prediction, decision, expected)
                    )
                    # Deliberately disagree with the risk bands: the stored
                    # prediction, rather than a score threshold, defines outcome.
                    score = 18.65 if prediction == "Phishing" else 89.0
                    self.add_scan(scan_id, prediction, score, user_id)
                    response = self.client.patch(
                        f"/api/v1/scans/{scan_id}/review",
                        json={"decision": decision, "note": "Checked by analyst"},
                    )
                    self.assertEqual(response.status_code, 200, response.text)
                    self.assertEqual(response.json()["decision"], decision)
                    detail = self.client.get(f"/api/v1/scans/{scan_id}")
                    self.assertEqual(detail.status_code, 200, detail.text)
                    self.assertIsNotNone(detail.json()["review_date"])
                    for record in (detail.json(), self.listed_scan(scan_id, collection)):
                        self.assertEqual(record["decision"], decision)
                        self.assertEqual(record["model_outcome"], expected)
                        self.assertEqual(record["risk_score"], score)
                        self.assertEqual(record["prediction"], prediction)
                        self.assertEqual(record["review_status"], "Completed")
                        self.assertEqual(record["note"], "Checked by analyst")

    def test_existing_false_positive_reviews_are_read_without_rewriting_history(self):
        for scan_id, prediction, expected in (
            (1, "Legitimate", "True Negative"),
            (2, "Phishing", "False Positive"),
        ):
            self.add_scan(scan_id, prediction, decision="False Positive", status="Completed")
            for record in (
                self.client.get(f"/api/v1/scans/{scan_id}").json(),
                self.listed_scan(scan_id, "live"),
            ):
                self.assertEqual(record["decision"], "Confirmed Legitimate")
                self.assertEqual(record["model_outcome"], expected)
            stored = self.db.execute(text(
                "SELECT analyst_decision FROM scan_results WHERE scan_id = :id"
            ), {"id": scan_id}).scalar_one()
            self.assertEqual(stored, "False Positive")

    def test_older_clients_can_still_submit_not_phishing(self):
        self.add_scan(1, "Legitimate")
        response = self.client.patch(
            "/api/v1/scans/1/review", json={"decision": "False Positive"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["decision"], "Confirmed Legitimate")
        self.assertEqual(
            self.client.get("/api/v1/scans/1").json()["model_outcome"], "True Negative",
        )

    def test_pending_or_unknown_predictions_have_no_outcome(self):
        self.add_scan(1, "Legitimate")
        self.assertIsNone(self.client.get("/api/v1/scans/1").json()["model_outcome"])
        self.assertIsNone(self.listed_scan(1, "live")["model_outcome"])
        for prediction in (None, "Unknown", ""):
            self.assertIsNone(review_fields(
                prediction, "Confirmed Legitimate", "Completed",
            )["model_outcome"])

    def test_invalid_decision_does_not_complete_review(self):
        self.add_scan(1, "Legitimate")
        response = self.client.patch(
            "/api/v1/scans/1/review", json={"decision": "True Negative"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            self.client.get("/api/v1/scans/1").json()["review_status"], "Pending",
        )

    def test_other_users_scans_cannot_be_read_or_reviewed(self):
        self.add_scan(1, "Legitimate", user_id=2)
        self.assertEqual(self.client.get("/api/v1/scans/1").status_code, 404)
        response = self.client.patch(
            "/api/v1/scans/1/review", json={"decision": "Confirmed Legitimate"},
        )
        self.assertEqual(response.status_code, 404)
        stored = self.db.execute(text(
            "SELECT review_status FROM scan_results WHERE scan_id = 1"
        )).scalar_one()
        self.assertEqual(stored, "Pending")
