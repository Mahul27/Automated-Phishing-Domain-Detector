"""Manual feed regression checks with temporary state and no external services.

Run explicitly: python -m unittest backend.tests.test_opensquat_manual -v
"""

import json
import os
import subprocess
import tempfile
import threading
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from pymysql.err import IntegrityError as MySQLIntegrityError
from sqlalchemy.exc import IntegrityError


# Keep standalone unit tests independent of local credentials and legacy ORM tests.
with patch.dict(os.environ, {
    "DB_HOST": "127.0.0.1",
    "DB_PORT": "3306",
    "DB_USER": "unit_test",
    "DB_PASSWORD": "unit_test",
    "DB_NAME": "unit_test",
}), patch("dotenv.load_dotenv", return_value=False):
    from backend.services import opensquat_service as service
    from backend.services import scan_service


class ManualOpenSquatTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="opensquat-manual-test-")
        self.addCleanup(temporary.cleanup)
        self.state_file = Path(temporary.name) / "state.json"
        self._patch("STATE_FILE", self.state_file)

        session = MagicMock()
        self.session = session
        session.__enter__.return_value.execute.return_value.scalars.return_value.all.return_value = []
        self._patch("SessionLocal", MagicMock(return_value=session))
        self.source = self._patch("fetch_opensquat_domains", MagicMock(return_value=["fixture-one.com"]))
        self.scan = self._patch("scan_domain", MagicMock())
        self.logger = self._patch("logger", MagicMock())

    def _patch(self, attribute, value):
        replacement = patch.object(service, attribute, value)
        self.addCleanup(replacement.stop)
        return replacement.start()

    def _previous_fetch(self):
        timestamp = "2001-01-01T00:00:00+00:00"
        self.state_file.write_text(json.dumps({"last_fetch_at": timestamp}), encoding="utf-8")
        return timestamp, self.state_file.read_bytes()

    def assert_utc_timestamp(self, value):
        timestamp = datetime.fromisoformat(value)
        self.assertIsNotNone(timestamp.tzinfo)
        self.assertEqual(timestamp.utcoffset(), timedelta(0))

    def test_health_handles_missing_and_invalid_metadata(self):
        self.assertIsNone(service.opensquat_status()["last_fetch_at"])
        invalid_states = (
            "not json", "[]", "null", "42", "{}",
            '{"last_fetch_at":42}',
            '{"last_fetch_at":"invalid"}',
            '{"last_fetch_at":"2001-01-01T00:00:00"}',
        )
        for state in invalid_states:
            with self.subTest(state=state):
                self.state_file.write_text(state, encoding="utf-8")
                self.assertIsNone(service.opensquat_status()["last_fetch_at"])

    def test_health_normalizes_timezone_aware_metadata_to_utc(self):
        self.state_file.write_text(
            '{"last_fetch_at":"2001-01-01T02:00:00+02:00"}', encoding="utf-8"
        )
        self.assertEqual(service.opensquat_status()["last_fetch_at"], "2001-01-01T00:00:00+00:00")

    def test_success_persists_timestamp_and_accepts_maximum_batch(self):
        result = service.refresh_live_domains(2000)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["added_count"], 1)
        self.assertIsNone(result["error"])
        self.assert_utc_timestamp(result["last_fetch_at"])
        self.assertEqual(service.opensquat_status()["last_fetch_at"], result["last_fetch_at"])
        self.assertEqual(json.loads(self.state_file.read_text()), {"last_fetch_at": result["last_fetch_at"]})
        self.assertEqual(list(self.state_file.parent.glob("*.tmp")), [])
        self.scan.assert_called_once()

    def test_zero_additions_still_records_successful_fetch(self):
        previous, _ = self._previous_fetch()
        self.source.return_value = []
        result = service.refresh_live_domains(10)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["added_count"], 0)
        self.assert_utc_timestamp(result["last_fetch_at"])
        self.assertNotEqual(result["last_fetch_at"], previous)
        self.assertEqual(service.opensquat_status()["last_fetch_at"], result["last_fetch_at"])
        self.scan.assert_not_called()

    def test_failed_fetch_preserves_previous_successful_timestamp(self):
        previous, contents = self._previous_fetch()
        self.source.side_effect = RuntimeError("Source unavailable")
        result = service.refresh_live_domains(10)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["added_count"], 0)
        self.assertEqual(result["error_code"], "feed_unavailable")
        self.assertNotIn("Source unavailable", json.dumps(result))
        self.logger.exception.assert_called_once()
        self.assertEqual(self.state_file.read_bytes(), contents)
        self.assertEqual(service.opensquat_status()["last_fetch_at"], previous)
        self.scan.assert_not_called()

    def test_partial_success_counts_saved_domains_and_records_fetch(self):
        self.source.return_value = ["fixture-one.com", "fixture-two.com"]
        self.scan.side_effect = [None, RuntimeError("Analysis unavailable")]
        result = service.refresh_live_domains(10)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["added_count"], 1)
        self.assertEqual(result["failed_count"], 1)
        self.assertEqual(result["error_code"], "scan_failed")
        self.assertIn("1 domain could not be scanned", result["error"])
        self.assertNotIn("Analysis unavailable", json.dumps(result))
        self.assert_utc_timestamp(result["last_fetch_at"])
        self.assertEqual(service.opensquat_status()["last_fetch_at"], result["last_fetch_at"])

    def test_metadata_write_failure_keeps_scan_success_and_warns(self):
        # A regular file cannot serve as the metadata directory.
        blocked_directory = self.state_file.parent / "blocked"
        blocked_directory.write_text("fixture", encoding="utf-8")
        self._patch("STATE_FILE", blocked_directory / "state.json")
        result = service.refresh_live_domains(10)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["added_count"], 1)
        self.assertIsNone(result["error"])
        self.assertIn("could not be saved", result["warning"])
        self.assertEqual(result["warning_code"], "fetch_time_not_saved")
        self.assert_utc_timestamp(result["last_fetch_at"])
        self.assertIsNone(service.opensquat_status()["last_fetch_at"])

    def test_raw_duplicate_error_is_logged_and_batch_continues_to_selected_limit(self):
        self.source.return_value = [f"fixture-{index}.com" for index in range(12)]
        duplicate = IntegrityError(
            "INSERT INTO domains (domain_name) VALUES (%(domain)s)",
            {"domain": "88312.at"},
            MySQLIntegrityError(1062, "Duplicate entry '88312.at' for key 'domains.domain_name'"),
        )
        self.scan.side_effect = [duplicate] + [None] * 11
        result = service.refresh_live_domains(10)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["added_count"], 10)
        self.assertEqual(result["failed_count"], 1)
        self.assertEqual(self.scan.call_count, 11)
        for technical_detail in ("88312.at", "1062", "INSERT", "parameters", "sqlalche.me"):
            self.assertNotIn(technical_detail, json.dumps(result))
        self.logger.exception.assert_called_once_with("Could not scan live domain %s", "fixture-0.com")

    def test_all_scan_failures_preserve_timestamp_and_return_safe_count(self):
        previous, contents = self._previous_fetch()
        self.source.return_value = ["fixture-one.com", "fixture-two.com"]
        self.scan.side_effect = RuntimeError("[SQL: secret database detail]")
        result = service.refresh_live_domains(10)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["added_count"], 0)
        self.assertEqual(result["failed_count"], 2)
        self.assertIn("2 domains could not be scanned", result["error"])
        self.assertNotIn("secret", json.dumps(result))
        self.assertEqual(self.state_file.read_bytes(), contents)
        self.assertEqual(service.opensquat_status()["last_fetch_at"], previous)
        self.assertFalse(service.opensquat_status()["refresh_running"])

    def test_saved_live_domains_are_skipped_without_error_or_rescan(self):
        self.session.__enter__.return_value.execute.return_value.scalars.return_value.all.return_value = ["fixture-one.com"]
        result = service.refresh_live_domains(10)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["added_count"], 0)
        self.assertEqual(result["failed_count"], 0)
        self.assertIsNone(result["error"])
        self.scan.assert_not_called()

    def test_database_read_error_is_safe_and_preserves_timestamp(self):
        _, contents = self._previous_fetch()
        self.session.__enter__.return_value.execute.side_effect = RuntimeError("[SQL: private query]")
        result = service.refresh_live_domains(10)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error_code"], "database_unavailable")
        self.assertNotIn("private", json.dumps(result))
        self.assertEqual(self.state_file.read_bytes(), contents)
        self.scan.assert_not_called()

    def test_source_timeout_is_safe_and_preserves_timestamp(self):
        _, contents = self._previous_fetch()
        self.source.side_effect = subprocess.TimeoutExpired("private command", 600, output="private output")
        result = service.refresh_live_domains(10)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error_code"], "feed_timeout")
        self.assertNotIn("private", json.dumps(result))
        self.assertEqual(self.state_file.read_bytes(), contents)
        self.scan.assert_not_called()

    def test_unexpected_api_exception_returns_safe_http_error(self):
        from backend import main as api

        with patch.object(api, "refresh_live_domains", side_effect=RuntimeError("[SQL: private query]")), \
                patch.object(api, "logger") as api_logger:
            response = TestClient(api.app).post("/api/v1/opensquat/refresh?limit=10")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {
            "detail": "Could not refresh the OpenSquat feed. Please try again later."
        })
        api_logger.exception.assert_called_once()

    def test_invalid_limits_are_rejected_before_fetching(self):
        for limit in (-1, 0, 2001):
            with self.subTest(limit=limit):
                result = service.refresh_live_domains(limit)
                self.assertEqual(result["status"], "failed")
                self.assertEqual(result["added_count"], 0)
        self.source.assert_not_called()
        self.scan.assert_not_called()

    def test_simultaneous_refresh_is_rejected(self):
        fetching = threading.Event()
        release = threading.Event()
        results = []

        def fetch():
            fetching.set()
            if not release.wait(5):
                raise RuntimeError("Test timed out waiting for release")
            return []

        self.source.side_effect = fetch
        worker = threading.Thread(target=lambda: results.append(service.refresh_live_domains(10)))
        worker.start()
        try:
            self.assertTrue(fetching.wait(2), "First refresh did not reach the source")
            self.assertTrue(service.opensquat_status()["refresh_running"])
            result = service.refresh_live_domains(10)
            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["added_count"], 0)
            self.assertIn("already running", result["error"])
            self.source.assert_called_once()
        finally:
            release.set()
            worker.join(3)
        self.assertFalse(worker.is_alive())
        self.assertEqual(results[0]["status"], "success")
        self.assertFalse(service.opensquat_status()["refresh_running"])


class ScanPersistenceTests(unittest.TestCase):
    def test_reused_domain_keeps_each_scans_features_and_model_output_separate(self):
        db = MagicMock()
        db.execute.side_effect = [
            SimpleNamespace(lastrowid=41), SimpleNamespace(lastrowid=101), None, None,
            SimpleNamespace(lastrowid=41), SimpleNamespace(lastrowid=102), None, None,
        ]
        prediction = {"prediction": 1, "phishing_probability": 0.8}
        with patch.object(scan_service, "extract_features", return_value={}), \
                patch.object(scan_service, "predict_domain", return_value=prediction):
            first = scan_service.scan_domain(db, "https://shared-fixture.invalid/path", "live", None)
            second = scan_service.scan_domain(db, "SHARED-FIXTURE.INVALID", "manual", 7)

        self.assertEqual(first["domain"], "shared-fixture.invalid")
        self.assertEqual(second["domain"], first["domain"])
        self.assertEqual((first["id"], second["id"]), (101, 102))
        self.assertEqual(first["risk_score"], 80)
        calls = db.execute.call_args_list
        self.assertEqual(calls[1].args[1]["domain_id"], 41)
        self.assertEqual(calls[5].args[1]["domain_id"], 41)
        self.assertEqual(calls[1].args[1]["user_id"], None)
        self.assertEqual(calls[5].args[1]["user_id"], 7)
        self.assertEqual([calls[index].args[1]["scan_id"] for index in (2, 3, 6, 7)], [101, 101, 102, 102])
        self.assertEqual(db.commit.call_count, 2)

    def test_missing_domain_identifier_cannot_commit_or_count_a_scan(self):
        db = MagicMock()
        db.execute.return_value = SimpleNamespace(lastrowid=0)
        with patch.object(scan_service, "extract_features", return_value={}), \
                patch.object(scan_service, "predict_domain", return_value={"prediction": 0, "phishing_probability": 0.1}):
            with self.assertRaisesRegex(RuntimeError, "Could not identify the domain record"):
                scan_service.scan_domain(db, "fixture.invalid", "live", None)
        db.commit.assert_not_called()
        self.assertEqual(db.execute.call_count, 1)


if __name__ == "__main__":
    unittest.main()
