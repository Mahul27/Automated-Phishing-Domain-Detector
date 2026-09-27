"""Dashboard calculations for MySQL scan dictionaries."""

from datetime import date, timedelta


def build_dashboard_summary(scans, today: date) -> dict:
    first_day = today - timedelta(days=6)

    risk_distribution = {
        "Low": 0,
        "Medium": 0,
        "High": 0,
    }

    daily = {
        first_day + timedelta(days=i): {
            "monitored": 0,
            "high_risk": 0,
        }
        for i in range(7)
    }

    previous_monitored = 0
    previous_high_risk = 0

    for scan in scans:

        score = float(
            scan["risk_score"] or 0
        )

        if score >= 75:
            category = "High"

        elif score >= 40:
            category = "Medium"

        else:
            category = "Low"

        risk_distribution[category] += 1

        scan_time = scan["scan_time"]

        if hasattr(scan_time, "date"):
            scan_date = scan_time.date()
        else:
            scan_date = scan_time

        if scan_date < first_day:

            previous_monitored += 1

            if category == "High":
                previous_high_risk += 1

        elif scan_date in daily:

            daily[scan_date]["monitored"] += 1

            if category == "High":
                daily[scan_date]["high_risk"] += 1

    weekly_trend = []

    monitored = previous_monitored
    high_risk = previous_high_risk

    for day, counts in daily.items():

        monitored += counts["monitored"]
        high_risk += counts["high_risk"]

        weekly_trend.append(
            {
                "name": day.strftime("%a"),
                "monitored": monitored,
                "high_risk": high_risk,
            }
        )

    return {
        "domains_monitored": len(scans),

        "high_risk_alerts": risk_distribution[
            "High"
        ],

        "pending_review": len(scans),

        "reviewed": 0,

        "risk_distribution": risk_distribution,

        "weekly_trend": weekly_trend,
    }