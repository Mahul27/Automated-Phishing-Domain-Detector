from pathlib import Path
import csv
import sys


# Project directories
BASE_DIR = Path(__file__).resolve().parent.parent
CANDIDATE_FILE = BASE_DIR / "opensquat" / "candidate_domains.txt"
OUTPUT_FILE = BASE_DIR / "opensquat" / "candidate_features_test_10.csv"

TEST_LIMIT = 10


# Allow imports from the Backend directory
sys.path.insert(0, str(BASE_DIR))

from services.feature_engineering import extract_features


def load_candidate_domains():
    """Load only the first 10 candidate domains."""
    if not CANDIDATE_FILE.exists():
        raise FileNotFoundError(
            f"Candidate file not found: {CANDIDATE_FILE}"
        )

    domains = []

    with CANDIDATE_FILE.open("r", encoding="utf-8") as file:
        for line in file:
            domain = line.strip()

            if domain:
                domains.append(domain)

            if len(domains) >= TEST_LIMIT:
                break

    return domains


def main():
    domains = load_candidate_domains()

    print(f"Testing {len(domains)} candidate domains.")
    print()

    results = []

    for index, domain in enumerate(domains, start=1):
        print(f"[{index}/{len(domains)}] Extracting features: {domain}")

        try:
            features = extract_features(domain)

            results.append({
                "domain": domain,
                **features,
            })

            print("  Feature extraction completed.")

        except Exception as error:
            print(f"  Feature extraction failed: {error}")

            results.append({
                "domain": domain,
                "domain_age_days": None,
                "registration_period_days": None,
                "domain_length": None,
                "num_hyphens": None,
                "num_digits": None,
                "entropy_domain": None,
                "brand_keyword": None,
                "typosquatting_score": None,
                "ssl_certificate_age_days": None,
                "tld": None,
            })

    fieldnames = [
        "domain",
        "domain_age_days",
        "registration_period_days",
        "domain_length",
        "num_hyphens",
        "num_digits",
        "entropy_domain",
        "brand_keyword",
        "typosquatting_score",
        "ssl_certificate_age_days",
        "tld",
    ]

    with OUTPUT_FILE.open(
        "w",
        newline="",
        encoding="utf-8"
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames
        )

        writer.writeheader()
        writer.writerows(results)

    print()
    print("Test completed.")
    print(f"Domains processed: {len(results)}")
    print(f"Output file: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()