"""Run once from the project root: python -m backend.scripts.refresh_live."""

import argparse

from backend.config import LIVE_SCAN_LIMIT
from backend.services.opensquat_service import fetch_opensquat_domains, refresh_live_domains


def main():
    parser = argparse.ArgumentParser(description="Refresh live domains from today's OpenSquat feed")
    parser.add_argument("--limit", type=int, default=LIVE_SCAN_LIMIT, help="Maximum new domains to scan")
    parser.add_argument("--source-only", action="store_true", help="List domains without scanning or saving")
    args = parser.parse_args()
    if args.limit < 1 or args.limit > 50:
        parser.error("--limit must be between 1 and 50")

    if args.source_only:
        domains = fetch_opensquat_domains()
        print(f"OpenSquat returned {len(domains)} distinct domains")
        for domain in domains[: args.limit]:
            print(domain)
        return

    result = refresh_live_domains(args.limit)
    print(f"Status: {result['status']}; new live domains: {result['added_count']}")
    if result["error"]:
        print(f"Details: {result['error']}")
    if result["status"] == "failed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
