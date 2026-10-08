"""API flow checks using an isolated database and a verified fake user."""

import os
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient
import numpy as np


temporary_database = tempfile.TemporaryDirectory(prefix="threat-hunter-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{temporary_database.name}/scans.db"
os.environ["AUTO_SCAN_ENABLED"] = "0"
os.environ["LIVE_SCAN_LIMIT"] = "50"
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_PUBLISHABLE_KEY"] = "test-publishable-key"

from backend.auth import CurrentUser, get_current_user  # noqa: E402
from backend.database import Base, engine  # noqa: E402
from backend.services.model_service import MODEL_FILE, _xgboost_explanation  # noqa: E402
from backend.services.opensquat_service import refresh_live_domains  # noqa: E402
from backend.services.scan_service import scan_domain  # noqa: E402
from backend.main import app  # noqa: E402


SAMPLE_FEATURES = {
    "domain_age_days": 4,
    "registration_period_days": 365,
    "domain_length": 16,
    "num_hyphens": 1,
    "num_digits": 0,
    "entropy_domain": 3.2,
    "brand_keyword": 1,
    "typosquatting_score": 0.8,
    "ssl_certificate_age_days": None,
    "tld": "com",
}


class ApiFlowTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        app.dependency_overrides[get_current_user] = lambda: CurrentUser("user-one", "one@example.com")
        self.features = patch("backend.services.scan_service.extract_features", return_value=SAMPLE_FEATURES)
        self.features.start()
        self.model = patch(
            "backend.services.model_service._load_model",
            return_value=(None, None, "Training CSV missing: test fixture"),
        )
        self.model.start()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.model.stop()
        self.features.stop()
        app.dependency_overrides.clear()

    def test_personal_scan_review_and_user_isolation(self):
        created = self.client.post("/api/v1/scans", json={"domain": "microsoft-support.com"})
        self.assertEqual(created.status_code, 200, created.text)
        record = created.json()
        self.assertEqual(record["source"], "manual")
        self.assertEqual(record["model_name"], "Heuristic (training dataset missing)")
        self.assertEqual(len(self.client.get("/api/v1/scans?collection=personal").json()["records"]), 1)

        reviewed = self.client.patch(
            f"/api/v1/scans/{record['id']}/review",
            json={"decision": "Confirmed Phishing", "note": "Brand impersonation"},
        )
        self.assertEqual(reviewed.status_code, 200)
        reloaded = self.client.get(f"/api/v1/scans/{record['id']}").json()
        self.assertEqual(reloaded["review_status"], "Completed")
        self.assertEqual(reloaded["note"], "Brand impersonation")
        self.assertEqual(self.client.get("/api/v1/dashboard/summary").json()["domains_monitored"], 0)

        app.dependency_overrides[get_current_user] = lambda: CurrentUser("user-two", "two@example.com")
        self.assertEqual(self.client.get("/api/v1/scans?collection=personal").json()["records"], [])
        self.assertEqual(self.client.get(f"/api/v1/scans/{record['id']}").status_code, 404)
        self.assertEqual(
            self.client.patch(
                f"/api/v1/scans/{record['id']}/review",
                json={"decision": "False Positive"},
            ).status_code,
            404,
        )

    def test_import_and_live_dashboard_match(self):
        upload = self.client.post(
            "/api/v1/imports",
            files={"file": ("domains.csv", "domain\nexample.com\nnot a domain\n", "text/csv")},
        )
        self.assertEqual(upload.status_code, 200, upload.text)
        self.assertEqual(upload.json()["accepted_count"], 1)
        self.assertEqual(upload.json()["rejected_count"], 1)

        json_upload = self.client.post(
            "/api/v1/imports",
            files={"file": ("domains.json", '[{"domain":"another-example.com"}]', "application/json")},
        )
        self.assertEqual(json_upload.status_code, 200, json_upload.text)
        self.assertEqual(json_upload.json()["accepted_count"], 1)

        with patch("backend.services.opensquat_service.fetch_opensquat_domains", return_value=["fresh-one.com", "fresh-two.com"]):
            first = refresh_live_domains(limit=7)
            second = refresh_live_domains(limit=7)
        self.assertEqual(first["added_count"], 2)
        self.assertEqual(second["added_count"], 0)
        live = self.client.get("/api/v1/scans?collection=live").json()["records"]
        summary = self.client.get("/api/v1/dashboard/summary").json()
        self.assertEqual(len(live), summary["domains_monitored"])
        self.assertEqual(summary["weekly_trend"][-1]["monitored"], summary["domains_monitored"])
        self.assertEqual(sum(summary["risk_distribution"].values()), summary["domains_monitored"])
        self.assertEqual(self.client.get("/api/v1/health").json()["opensquat"]["status"], "success")

        self.client.patch(
            f"/api/v1/scans/{live[0]['id']}/review", json={"decision": "False Positive"}
        )
        updated = self.client.get("/api/v1/dashboard/summary").json()
        self.assertEqual(updated["reviewed"], 1)
        self.assertEqual(updated["pending_review"], 1)

    def test_default_refresh_saves_at_most_fifty_new_domains(self):
        candidates = [f"daily-domain-{index}.com" for index in range(51)]
        with patch("backend.services.opensquat_service.fetch_opensquat_domains", return_value=candidates):
            result = refresh_live_domains()
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["added_count"], 50)
        self.assertEqual(len(self.client.get("/api/v1/scans?collection=live").json()["records"]), 50)

    def test_failed_live_domain_is_retried_instead_of_marked_used(self):
        attempts = 0

        def fail_once(db, domain, source, user_id):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise RuntimeError("Temporary lookup failure")
            return scan_domain(db, domain, source, user_id)

        with patch(
            "backend.services.opensquat_service.fetch_opensquat_domains",
            return_value=["retry-example.com"],
        ), patch("backend.services.opensquat_service.scan_domain", side_effect=fail_once):
            first = refresh_live_domains(limit=1)
            second = refresh_live_domains(limit=1)

        self.assertEqual(first["status"], "failed")
        self.assertEqual(first["added_count"], 0)
        self.assertEqual(second["added_count"], 1)
        self.assertEqual(attempts, 2)

    def test_low_percentage_score_is_not_multiplied_twice(self):
        result = {
            "prediction": 0,
            "phishing_probability": 0.005,
            "model_name": "XGBoost",
            "explanation": "Test prediction",
        }
        with patch("backend.services.scan_service.predict_domain", return_value=result):
            created = self.client.post("/api/v1/scans", json={"domain": "low-risk.com"})
        self.assertEqual(created.status_code, 200, created.text)
        self.assertEqual(created.json()["risk_score"], 0.5)
        reloaded = self.client.get(f"/api/v1/scans/{created.json()['id']}")
        self.assertEqual(reloaded.json()["risk_score"], 0.5)

    def test_supabase_token_is_verified_before_personal_data(self):
        app.dependency_overrides.clear()
        self.assertEqual(self.client.get("/api/v1/scans?collection=personal").status_code, 401)

        with patch("backend.auth.requests.get") as supabase_request:
            supabase_request.return_value.status_code = 200
            supabase_request.return_value.json.return_value = {
                "id": "user-one", "email": "one@example.com"
            }
            response = self.client.get(
                "/api/v1/scans?collection=personal",
                headers={"Authorization": "Bearer test-access-token"},
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(supabase_request.call_args.args[0].endswith("/auth/v1/user"))
        self.assertEqual(
            supabase_request.call_args.kwargs["headers"]["Authorization"],
            "Bearer test-access-token",
        )

    def test_browser_preflight_allows_an_alternate_local_vite_port(self):
        response = self.client.options(
            "/api/v1/scans?collection=live",
            headers={
                "Origin": "http://localhost:5174",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:5174")


class AutomaticRefreshTests(unittest.TestCase):
    def test_backend_start_runs_refresh_when_due(self):
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        started = threading.Event()

        def fake_refresh():
            started.set()
            return {"status": "success", "error": None, "added_count": 0}

        with patch("backend.main.AUTO_SCAN_ENABLED", True), patch(
            "backend.main.refresh_live_domains", side_effect=fake_refresh
        ) as refresh:
            with TestClient(app):
                self.assertTrue(started.wait(2), "The daily refresh did not start with the API")
            refresh.assert_called_once_with()


class ModelExplanationTests(unittest.TestCase):
    def test_saved_xgboost_model_loads_and_returns_shap_values(self):
        from xgboost import DMatrix, XGBClassifier

        model = XGBClassifier()
        model.load_model(MODEL_FILE)
        data = DMatrix(np.zeros((1, model.n_features_in_)))
        contributions = model.get_booster().predict(data, pred_contribs=True)
        self.assertEqual(contributions.shape, (1, model.n_features_in_ + 1))

    def test_shap_summary_groups_one_hot_tld_columns(self):
        preprocessor = Mock()
        preprocessor.get_feature_names_out.return_value = [
            "numeric__domain_age_days", "tld__tld_com", "tld__tld_net"
        ]
        model = Mock()
        model.get_booster.return_value.predict.return_value = np.array(
            [[0.5, -0.3, 0.1, 0.2]]
        )

        explanation = _xgboost_explanation(preprocessor, model, np.zeros((1, 3)))
        self.assertIn("domain_age_days raised", explanation)
        self.assertIn("tld lowered", explanation)
        self.assertIn("XGBoost SHAP", explanation)


if __name__ == "__main__":
    unittest.main()
