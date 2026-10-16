
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend.config import (
    AUTO_SCAN_ENABLED,
    AUTO_SCAN_INTERVAL_HOURS,
)
from backend.services.opensquat_service import refresh_live_domains


scheduler = BackgroundScheduler(timezone="UTC")


def run_scheduled_opensquat():
    """Run the existing OpenSquat live-feed refresh."""
    print("[OpenSquat Scheduler] Starting refresh...")

    try:
        result = refresh_live_domains()
        print(f"[OpenSquat Scheduler] Refresh result: {result}")
    except Exception as error:
        print(f"[OpenSquat Scheduler] Refresh failed: {error}")


def start_scheduler():
    """Run once immediately, then repeat at the configured interval."""
    if not AUTO_SCAN_ENABLED:
        print("[OpenSquat Scheduler] Automatic scanning is disabled.")
        return

    if scheduler.running:
        print("[OpenSquat Scheduler] Already running.")
        return

    scheduler.add_job(
        run_scheduled_opensquat,
        trigger=IntervalTrigger(hours=AUTO_SCAN_INTERVAL_HOURS),
        id="opensquat_live_feed",
        name="OpenSquat live-feed refresh",
        next_run_time=datetime.now(timezone.utc),
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
        replace_existing=True,
    )

    scheduler.start()

    print(
        "[OpenSquat Scheduler] Started. "
        f"First run: immediately; repeat every "
        f"{AUTO_SCAN_INTERVAL_HOURS} hour(s)."
    )


def stop_scheduler():
    """Stop the scheduler when FastAPI shuts down."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[OpenSquat Scheduler] Stopped.")
