from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import Counter
from difflib import SequenceMatcher
import json
import math
import socket
import ssl
import time

import requests
import tldextract


# ============================================================
# Project configuration
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

BRANDS_FILE = DATA_DIR / "brands_keywords.txt"
CACHE_FILE = DATA_DIR / "feature_cache.json"

REQUEST_TIMEOUT = 5

# Limited retries for temporary network failures.
MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 1.5

# Cache freshness.
RDAP_CACHE_TTL = timedelta(days=7)
SSL_CACHE_TTL = timedelta(days=1)

HTTPS_PORT = 443


# ============================================================
# Cache helpers
# ============================================================

def load_cache():
    """Load the persistent feature cache."""

    if not CACHE_FILE.exists():
        return {
            "rdap": {},
            "ssl": {}
        }

    try:
        with CACHE_FILE.open("r", encoding="utf-8") as file:
            cache = json.load(file)

        cache.setdefault("rdap", {})
        cache.setdefault("ssl", {})

        return cache

    except (json.JSONDecodeError, OSError):
        print("Feature cache could not be read. Starting with empty cache.")

        return {
            "rdap": {},
            "ssl": {}
        }


def save_cache(cache):
    """Save the persistent feature cache safely."""

    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)

    temporary_file = CACHE_FILE.with_suffix(".tmp")

    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(cache, file, indent=2)

    temporary_file.replace(CACHE_FILE)


CACHE = load_cache()


def utc_now():
    """Return the current UTC time."""

    return datetime.now(timezone.utc)


def parse_iso_datetime(value):
    """Convert an ISO timestamp into a timezone-aware datetime."""

    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(value)

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed.astimezone(timezone.utc)

    except (ValueError, TypeError):
        return None


def is_cache_fresh(timestamp, ttl):
    """Check whether cached information is still fresh."""

    cached_time = parse_iso_datetime(timestamp)

    if cached_time is None:
        return False

    return utc_now() - cached_time < ttl


# ============================================================
# Brand keywords
# ============================================================

def load_brand_keywords():
    """Load brand keywords from brands_keywords.txt."""

    if not BRANDS_FILE.exists():
        print(f"Brand keyword file not found: {BRANDS_FILE}")
        return []

    with BRANDS_FILE.open("r", encoding="utf-8") as file:
        return [
            line.strip().lower()
            for line in file
            if line.strip()
        ]


BRAND_KEYWORDS = load_brand_keywords()


# ============================================================
# Domain parsing helpers
# ============================================================

def get_extracted_domain(domain):
    """Extract the domain using tldextract."""

    return tldextract.extract(domain)


def get_main_domain(domain):
    """Return the main domain without the TLD."""

    extracted = get_extracted_domain(domain)

    return extracted.domain


def get_registrable_domain(domain):
    """Return the registrable domain including the TLD."""

    extracted = get_extracted_domain(domain)

    if extracted.suffix:
        return f"{extracted.domain}.{extracted.suffix}"

    return extracted.domain


def get_hostname(domain):
    """Return a hostname suitable for network connections."""

    domain = domain.strip()

    if "://" in domain:
        domain = domain.split("://", 1)[1]

    domain = domain.split("/", 1)[0]
    domain = domain.split(":", 1)[0]

    return domain.lower().strip()


# ============================================================
# Feature 1 — Domain Age
# ============================================================

def calculate_domain_age(rdap_data):
    """
    Calculate domain age in days from the RDAP registration date.
    """

    if not rdap_data:
        return None

    registration_date = rdap_data.get("registration")

    if not registration_date:
        return None

    age = utc_now() - registration_date

    return max(age.days, 0)


# ============================================================
# Feature 2 — Registration Period
# ============================================================

def calculate_registration_period(rdap_data):
    """
    Calculate registration period as:

    expiration date - registration date
    """

    if not rdap_data:
        return None

    registration_date = rdap_data.get("registration")
    expiration_date = rdap_data.get("expiration")

    if not registration_date or not expiration_date:
        return None

    return max(
        (expiration_date - registration_date).days,
        0
    )


# ============================================================
# IANA RDAP bootstrap
# ============================================================

_RDAP_SERVERS = None


def get_rdap_servers():
    """
    Load the IANA RDAP bootstrap once per program run.

    This prevents downloading the bootstrap file for every domain.
    """

    global _RDAP_SERVERS

    if _RDAP_SERVERS is not None:
        return _RDAP_SERVERS

    url = "https://data.iana.org/rdap/dns.json"

    for attempt in range(MAX_RETRIES + 1):

        try:

            response = requests.get(
                url,
                timeout=REQUEST_TIMEOUT,
                headers={
                    "User-Agent": "ThreatHunter-Capstone/1.0"
                }
            )

            response.raise_for_status()

            data = response.json()

            servers = {}

            for service in data.get("services", []):

                if len(service) < 2:
                    continue

                tlds = service[0]
                urls = service[1]

                for tld in tlds:

                    servers[tld.lower()] = urls[0]

            _RDAP_SERVERS = servers

            return _RDAP_SERVERS

        except (
            requests.RequestException,
            ValueError
        ) as error:

            if attempt < MAX_RETRIES:

                time.sleep(
                    RETRY_DELAY_SECONDS
                )

            else:

                print(
                    f"Could not load IANA RDAP bootstrap: {error}"
                )

    _RDAP_SERVERS = {}

    return _RDAP_SERVERS


def get_authoritative_rdap_url(domain):
    """Find the authoritative RDAP server for the domain TLD."""

    extracted = get_extracted_domain(domain)

    tld = extracted.suffix.lower()

    if not tld:
        return None

    servers = get_rdap_servers()

    return servers.get(tld)


# ============================================================
# RDAP
# ============================================================

def parse_rdap_events(data):
    """Extract registration and expiration dates from RDAP."""

    registration = None
    expiration = None

    for event in data.get("events", []):

        event_action = event.get("eventAction")
        event_date = event.get("eventDate")

        if not event_date:
            continue

        parsed_date = parse_iso_datetime(event_date)

        if not parsed_date:
            continue

        if event_action == "registration":
            registration = parsed_date

        elif event_action == "expiration":
            expiration = parsed_date

    return {
        "registration": registration,
        "expiration": expiration
    }


def get_rdap_data(domain):
    """
    Get RDAP registration information.

    One successful RDAP lookup provides both:

    - Domain Age
    - Registration Period

    Successful results are cached for seven days.
    """

    domain = get_registrable_domain(domain)

    cached = CACHE["rdap"].get(domain)

    if cached and is_cache_fresh(
        cached.get("checked_at"),
        RDAP_CACHE_TTL
    ):

        return {
            "registration": parse_iso_datetime(
                cached.get("registration")
            ),
            "expiration": parse_iso_datetime(
                cached.get("expiration")
            )
        }

    rdap_base_url = get_authoritative_rdap_url(domain)

    if not rdap_base_url:

        tld = get_extracted_domain(domain).suffix

        print(
            f"No RDAP server found for .{tld}"
        )

        CACHE["rdap"][domain] = {
            "checked_at": utc_now().isoformat(),
            "registration": None,
            "expiration": None,
            "status": "no_rdap_server"
        }

        save_cache(CACHE)

        return None

    url = (
        f"{rdap_base_url.rstrip('/')}"
        f"/domain/{domain}"
    )

    for attempt in range(MAX_RETRIES + 1):

        try:

            response = requests.get(
                url,
                timeout=REQUEST_TIMEOUT,
                headers={
                    "Accept": (
                        "application/rdap+json, "
                        "application/json"
                    ),
                    "User-Agent": (
                        "ThreatHunter-Capstone/1.0"
                    )
                }
            )

            response.raise_for_status()

            data = response.json()

            dates = parse_rdap_events(data)

            CACHE["rdap"][domain] = {
                "checked_at": utc_now().isoformat(),

                "registration": (
                    dates["registration"].isoformat()
                    if dates["registration"]
                    else None
                ),

                "expiration": (
                    dates["expiration"].isoformat()
                    if dates["expiration"]
                    else None
                ),

                "status": "success"
            }

            save_cache(CACHE)

            return dates

        except requests.Timeout:

            if attempt < MAX_RETRIES:

                time.sleep(
                    RETRY_DELAY_SECONDS
                )

                continue

            print(
                f"RDAP request timed out for {domain}"
            )

        except requests.ConnectionError as error:

            if attempt < MAX_RETRIES:

                time.sleep(
                    RETRY_DELAY_SECONDS
                )

                continue

            print(
                f"RDAP connection failed for "
                f"{domain}: {error}"
            )

        except requests.HTTPError as error:

            status_code = (
                error.response.status_code
                if error.response is not None
                else None
            )

            # Retry only temporary server/rate-limit errors.
            if status_code in {
                429,
                500,
                502,
                503,
                504
            }:

                if attempt < MAX_RETRIES:

                    time.sleep(
                        RETRY_DELAY_SECONDS
                    )

                    continue

            print(
                f"RDAP request failed for "
                f"{domain}: {error}"
            )

            break

        except (
            ValueError,
            requests.RequestException
        ) as error:

            print(
                f"RDAP request failed for "
                f"{domain}: {error}"
            )

            break

    # Cache failed result temporarily so that the same
    # unavailable domain is not repeatedly queried.
    CACHE["rdap"][domain] = {
        "checked_at": utc_now().isoformat(),
        "registration": None,
        "expiration": None,
        "status": "failed"
    }

    save_cache(CACHE)

    return None


# ============================================================
# Feature 3 — Domain Length
# ============================================================

def calculate_domain_length(domain):
    """
    Return the length of the main domain.

    This follows the original feature definition.
    """

    extracted = get_extracted_domain(domain)

    return len(extracted.domain)


# ============================================================
# Feature 4 — Number of Hyphens
# ============================================================

def calculate_num_hyphens(domain):
    """
    Count hyphens in the hostname.

    This follows the original feature definition.
    """

    hostname = get_hostname(domain)

    return hostname.count("-")


# ============================================================
# Feature 5 — Number of Digits
# ============================================================

def calculate_num_digits(domain):
    """
    Count digits in the main domain.

    This follows the original feature definition.
    """

    extracted = get_extracted_domain(domain)

    return sum(
        character.isdigit()
        for character in extracted.domain
    )


# ============================================================
# Feature 6 — Shannon Entropy
# ============================================================

def calculate_entropy(domain):
    """
    Calculate Shannon entropy of the main domain.

    This follows the original feature definition.
    """

    extracted = get_extracted_domain(domain)

    domain_name = extracted.domain

    if not domain_name:
        return 0.0

    counts = Counter(domain_name)

    length = len(domain_name)

    entropy = 0.0

    for count in counts.values():

        probability = count / length

        entropy -= (
            probability *
            math.log2(probability)
        )

    return entropy


# ============================================================
# Feature 7 — Brand Keyword
# ============================================================

def calculate_brand_keyword(domain):
    """
    Detect whether a configured brand keyword occurs
    inside the main domain.

    This follows the original feature definition.
    """

    extracted = get_extracted_domain(domain)

    domain_name = extracted.domain.lower()

    for brand in BRAND_KEYWORDS:

        if brand in domain_name:
            return 1

    return 0


# ============================================================
# Feature 8 — Typosquatting Similarity
# ============================================================

def calculate_typosquatting_score(domain):
    """
    Calculate the maximum similarity against configured brands.

    IMPORTANT:
    This preserves the original teammate implementation.

    If the domain is shorter than the brand, the complete
    domain is still compared against that brand.

    Example:

        domain = googl
        brand  = google

    The comparison is:

        googl <-> google

    rather than skipping the comparison.
    """

    extracted = get_extracted_domain(domain)

    domain_name = extracted.domain.lower()

    if not domain_name:
        return 0.0

    best_score = 0.0

    for brand in BRAND_KEYWORDS:

        brand_length = len(brand)

        if len(domain_name) < brand_length:

            windows = [
                domain_name
            ]

        else:

            windows = [
                domain_name[i:i + brand_length]
                for i in range(
                    len(domain_name) -
                    brand_length +
                    1
                )
            ]

        for window in windows:

            score = SequenceMatcher(
                None,
                window,
                brand
            ).ratio()

            if score > best_score:
                best_score = score

    return round(best_score, 3)


# ============================================================
# Feature 9 — SSL Certificate Age
# ============================================================

def get_ssl_certificate_date(domain):
    """
    Retrieve the certificate notBefore date.

    The connection is made directly to the domain on port 443.

    Successful certificate dates are cached for 24 hours.
    """

    hostname = get_hostname(domain)

    cached = CACHE["ssl"].get(hostname)

    if cached and is_cache_fresh(
        cached.get("checked_at"),
        SSL_CACHE_TTL
    ):

        return parse_iso_datetime(
            cached.get("not_before")
        )

    context = ssl.create_default_context()

    for attempt in range(MAX_RETRIES + 1):

        try:

            with socket.create_connection(
                (hostname, HTTPS_PORT),
                timeout=REQUEST_TIMEOUT
            ) as sock:

                with context.wrap_socket(
                    sock,
                    server_hostname=hostname
                ) as secure_socket:

                    certificate = (
                        secure_socket.getpeercert()
                    )

                    not_before = (
                        certificate.get("notBefore")
                    )

                    if not not_before:

                        raise ValueError(
                            "Certificate has no "
                            "notBefore field"
                        )

                    certificate_date = (
                        datetime.strptime(
                            not_before,
                            "%b %d %H:%M:%S %Y %Z"
                        ).replace(
                            tzinfo=timezone.utc
                        )
                    )

                    CACHE["ssl"][hostname] = {
                        "checked_at": (
                            utc_now().isoformat()
                        ),
                        "not_before": (
                            certificate_date.isoformat()
                        ),
                        "status": "success"
                    }

                    save_cache(CACHE)

                    return certificate_date

        except (
            socket.timeout,
            TimeoutError,
            ConnectionError
        ) as error:

            if attempt < MAX_RETRIES:

                time.sleep(
                    RETRY_DELAY_SECONDS
                )

                continue

            print(
                f"{hostname}: "
                f"SSL connection failed: {error}"
            )

        except (
            socket.gaierror,
            ssl.SSLError,
            OSError,
            ValueError
        ) as error:

            print(
                f"{hostname}: "
                f"SSL connection failed: {error}"
            )

            break

    # Cache the failure for 24 hours so an unavailable
    # HTTPS service is not repeatedly contacted.
    CACHE["ssl"][hostname] = {
        "checked_at": utc_now().isoformat(),
        "not_before": None,
        "status": "failed"
    }

    save_cache(CACHE)

    return None


def calculate_ssl_certificate_age(domain):
    """Calculate SSL certificate age in days."""

    certificate_date = (
        get_ssl_certificate_date(domain)
    )

    if not certificate_date:
        return None

    age = utc_now() - certificate_date

    return max(age.days, 0)


# ============================================================
# Feature 10 — TLD
# ============================================================

def calculate_tld(domain):
    """
    Return the domain suffix.

    This follows the original feature definition.
    """

    extracted = get_extracted_domain(domain)

    return extracted.suffix


# ============================================================
# Main Feature Extraction
# ============================================================

def extract_features(domain):
    """
    Extract the final 10 features for one domain.

    Network behaviour:

    - Local features are calculated first.
    - One RDAP lookup provides both RDAP-based features.
    - RDAP information is cached.
    - SSL certificate dates are cached.
    - Temporary failures receive limited retries.
    - Permanent failures return None.
    """

    print(
        f"\nExtracting features for: {domain}"
    )

    # --------------------------------------------------------
    # Local features
    # --------------------------------------------------------

    domain_length = (
        calculate_domain_length(domain)
    )

    num_hyphens = (
        calculate_num_hyphens(domain)
    )

    num_digits = (
        calculate_num_digits(domain)
    )

    entropy_domain = (
        calculate_entropy(domain)
    )

    brand_keyword = (
        calculate_brand_keyword(domain)
    )

    typosquatting_score = (
        calculate_typosquatting_score(domain)
    )

    tld = calculate_tld(domain)

    # --------------------------------------------------------
    # RDAP
    # --------------------------------------------------------

    rdap_data = get_rdap_data(domain)

    domain_age = (
        calculate_domain_age(rdap_data)
    )

    registration_period = (
        calculate_registration_period(rdap_data)
    )

    # --------------------------------------------------------
    # SSL
    # --------------------------------------------------------

    ssl_certificate_age = (
        calculate_ssl_certificate_age(domain)
    )

    # --------------------------------------------------------
    # Final 10 features
    # --------------------------------------------------------

    return {
        "domain_age_days": domain_age,
        "registration_period_days": registration_period,
        "domain_length": domain_length,
        "num_hyphens": num_hyphens,
        "num_digits": num_digits,
        "entropy_domain": entropy_domain,
        "brand_keyword": brand_keyword,
        "typosquatting_score": typosquatting_score,
        "ssl_certificate_age_days": ssl_certificate_age,
        "tld": tld
    }


# ============================================================
# Local test
# ============================================================

if __name__ == "__main__":

    test_domain = "example.com"

    features = extract_features(
        test_domain
    )

    print("\nFeature results:")

    for feature, value in features.items():

        print(
            f"{feature}: {value}"
        )