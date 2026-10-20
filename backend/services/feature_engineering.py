
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
MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 1.5
HTTPS_PORT = 443

RDAP_CACHE_TTL = timedelta(days=7)
WHOIS_CACHE_TTL = timedelta(days=7)
SSL_CACHE_TTL = timedelta(days=1)


# ============================================================
# Cache helpers
# ============================================================

def load_cache():
    default_cache = {
        "rdap": {},
        "whois": {},
        "ssl": {},
    }

    if not CACHE_FILE.exists():
        return default_cache

    try:
        with CACHE_FILE.open("r", encoding="utf-8") as file:
            cache = json.load(file)

        for key in default_cache:
            if not isinstance(cache.get(key), dict):
                cache[key] = {}

        return cache

    except (json.JSONDecodeError, OSError):
        print("Feature cache could not be read; starting empty.")
        return default_cache


def save_cache(cache):
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary_file = CACHE_FILE.with_suffix(".tmp")

    try:
        with temporary_file.open("w", encoding="utf-8") as file:
            json.dump(cache, file, indent=2)

        temporary_file.replace(CACHE_FILE)

    except OSError as error:
        print(f"Could not save feature cache: {error}")

        try:
            temporary_file.unlink(missing_ok=True)
        except OSError:
            pass


CACHE = load_cache()


def utc_now():
    return datetime.now(timezone.utc)


def parse_iso_datetime(value):
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(
            str(value).replace("Z", "+00:00")
        )

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed.astimezone(timezone.utc)

    except (ValueError, TypeError, OverflowError):
        return None


def is_cache_fresh(timestamp, ttl):
    cached_time = parse_iso_datetime(timestamp)

    if cached_time is None:
        return False

    age = utc_now() - cached_time

    return timedelta(0) <= age < ttl


def normalise_source(source):
    return (
        str(source or "")
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


def is_manual_source(source):
    return normalise_source(source) in {
        "manual",
        "manual_scan",
    }


# ============================================================
# Brand keywords
# ============================================================

def load_brand_keywords():
    if not BRANDS_FILE.exists():
        print(f"Brand keyword file not found: {BRANDS_FILE}")
        return []

    try:
        with BRANDS_FILE.open("r", encoding="utf-8") as file:
            return [
                line.strip().lower()
                for line in file
                if line.strip()
            ]

    except OSError as error:
        print(f"Could not load brand keywords: {error}")
        return []


BRAND_KEYWORDS = load_brand_keywords()


# ============================================================
# Domain parsing
# ============================================================

def get_hostname(domain):
    value = str(domain).strip()

    if "://" in value:
        value = value.split("://", 1)[1]

    value = value.split("/", 1)[0]
    value = value.split("?", 1)[0]
    value = value.split("#", 1)[0]

    if value.count(":") == 1:
        value = value.rsplit(":", 1)[0]

    return value.rstrip(".").lower()


def get_extracted_domain(domain):
    return tldextract.extract(get_hostname(domain))


def get_main_domain(domain):
    return get_extracted_domain(domain).domain


def get_registrable_domain(domain):
    extracted = get_extracted_domain(domain)

    if extracted.domain and extracted.suffix:
        return f"{extracted.domain}.{extracted.suffix}"

    return extracted.domain


# ============================================================
# Date helpers
# ============================================================

def parse_whois_datetime(value):
    if value is None:
        return None

    if isinstance(value, (list, tuple, set)):
        dates = [
            parse_whois_datetime(item)
            for item in value
        ]

        dates = [
            item for item in dates
            if item is not None
        ]

        return min(dates) if dates else None

    if isinstance(value, datetime):
        parsed = value

    else:
        text_value = str(value).strip()

        try:
            parsed = datetime.fromisoformat(
                text_value.replace("Z", "+00:00")
            )

        except (ValueError, TypeError, OverflowError):
            parsed = None

            for date_format in (
                "%Y-%m-%d",
                "%Y/%m/%d",
                "%d-%b-%Y",
                "%Y.%m.%d",
            ):
                try:
                    parsed = datetime.strptime(
                        text_value,
                        date_format,
                    )
                    break

                except ValueError:
                    continue

            if parsed is None:
                return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed.astimezone(timezone.utc)


def calculate_age_from_registration_date(registration_date):
    if not registration_date:
        return None

    return max(
        (utc_now() - registration_date).days,
        0,
    )


# ============================================================
# Feature 1 — Domain Age
# ============================================================

def calculate_domain_age(rdap_data):
    if not rdap_data:
        return None

    return calculate_age_from_registration_date(
        rdap_data.get("registration")
    )


# ============================================================
# Feature 2 — Registration Period
# ============================================================

def calculate_registration_period(registration_data):
    """
    Calculate registration period in days.

    Registration period = expiry date - registration date.

    The caller selects WHOIS or RDAP based on scan source.
    """

    if not registration_data:
        return None

    registration_date = registration_data.get("registration")
    expiration_date = registration_data.get("expiration")

    if not registration_date or not expiration_date:
        return None

    if not isinstance(registration_date, datetime):
        registration_date = parse_whois_datetime(
            registration_date
        )

    if not isinstance(expiration_date, datetime):
        expiration_date = parse_whois_datetime(
            expiration_date
        )

    if not registration_date or not expiration_date:
        return None

    if expiration_date < registration_date:
        return None

    return (expiration_date - registration_date).days


# ============================================================
# RDAP bootstrap
# ============================================================

_RDAP_SERVERS = None


def get_rdap_servers():
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
                    "User-Agent": "ThreatHunter-Capstone/1.0",
                },
            )

            response.raise_for_status()
            data = response.json()

            servers = {}

            for service in data.get("services", []):
                if len(service) < 2:
                    continue

                tlds, urls = service[0], service[1]

                if not urls:
                    continue

                for tld in tlds:
                    servers[str(tld).lower()] = urls[0]

            _RDAP_SERVERS = servers
            return _RDAP_SERVERS

        except (requests.RequestException, ValueError) as error:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)

            else:
                print(
                    f"Could not load IANA RDAP bootstrap: {error}"
                )

    _RDAP_SERVERS = {}
    return _RDAP_SERVERS


def get_authoritative_rdap_url(domain):
    tld = get_extracted_domain(domain).suffix.lower()

    if not tld:
        return None

    return get_rdap_servers().get(tld)


# ============================================================
# RDAP response parsing
# ============================================================

def parse_rdap_events(data):
    registration = None
    expiration = None

    for event in data.get("events", []):
        action = str(
            event.get("eventAction", "")
        ).lower()

        event_date = parse_iso_datetime(
            event.get("eventDate")
        )

        if not event_date:
            continue

        if action == "registration":
            registration = event_date

        elif action == "expiration":
            expiration = event_date

    return {
        "registration": registration,
        "expiration": expiration,
    }


# ============================================================
# RDAP lookup
# Automated/OpenSquat scans use RDAP only.
# ============================================================

def get_rdap_data(domain):
    domain = get_registrable_domain(domain)

    if not domain:
        return None

    cached = CACHE["rdap"].get(domain)

    if cached and is_cache_fresh(
        cached.get("checked_at"),
        RDAP_CACHE_TTL,
    ):
        return {
            "registration": parse_iso_datetime(
                cached.get("registration")
            ),
            "expiration": parse_iso_datetime(
                cached.get("expiration")
            ),
        }

    rdap_base_url = get_authoritative_rdap_url(domain)

    if not rdap_base_url:
        print(f"No RDAP server found for {domain}")

        CACHE["rdap"][domain] = {
            "checked_at": utc_now().isoformat(),
            "registration": None,
            "expiration": None,
            "status": "no_rdap_server",
        }

        save_cache(CACHE)
        return None

    url = f"{rdap_base_url.rstrip('/')}/domain/{domain}"

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.get(
                url,
                timeout=REQUEST_TIMEOUT,
                headers={
                    "Accept": (
                        "application/rdap+json, application/json"
                    ),
                    "User-Agent": "ThreatHunter-Capstone/1.0",
                },
            )

            response.raise_for_status()
            dates = parse_rdap_events(response.json())

            CACHE["rdap"][domain] = {
                "checked_at": utc_now().isoformat(),
                "registration": (
                    dates["registration"].isoformat()
                    if dates["registration"] else None
                ),
                "expiration": (
                    dates["expiration"].isoformat()
                    if dates["expiration"] else None
                ),
                "status": "success",
            }

            save_cache(CACHE)
            return dates

        except requests.Timeout as error:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
                continue

            print(f"RDAP timed out for {domain}: {error}")

        except requests.ConnectionError as error:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
                continue

            print(f"RDAP connection failed for {domain}: {error}")

        except requests.HTTPError as error:
            status_code = (
                error.response.status_code
                if error.response is not None else None
            )

            if (
                status_code in {429, 500, 502, 503, 504}
                and attempt < MAX_RETRIES
            ):
                time.sleep(RETRY_DELAY_SECONDS)
                continue

            print(f"RDAP request failed for {domain}: {error}")
            break

        except (ValueError, requests.RequestException) as error:
            print(f"RDAP request failed for {domain}: {error}")
            break

    CACHE["rdap"][domain] = {
        "checked_at": utc_now().isoformat(),
        "registration": None,
        "expiration": None,
        "status": "failed",
    }

    save_cache(CACHE)
    return None


# ============================================================
# WHOIS lookup
# Manual scans: WHOIS first, RDAP expiry fallback only.
# ============================================================

def get_whois_data(domain, source):
    """
    For manual scans:
    1. Use WHOIS for registration and expiry dates.
    2. If WHOIS has no expiry date, use RDAP only for expiry.
    3. Never replace the WHOIS registration date with RDAP.
    """

    if not is_manual_source(source):
        return None

    domain = get_registrable_domain(domain)

    if not domain:
        return None

    cached = CACHE["whois"].get(domain)

    registration_date = None
    expiration_date = None

    # Reuse cache if it contains both dates.
    if cached and is_cache_fresh(
        cached.get("checked_at"),
        WHOIS_CACHE_TTL,
    ):
        registration_date = parse_iso_datetime(
            cached.get("registration")
        )

        expiration_date = parse_iso_datetime(
            cached.get("expiration")
        )

        # An older cache entry may not contain an expiration key.
        if (
            "expiration" in cached
            and expiration_date is not None
        ):
            return {
                "registration": registration_date,
                "expiration": expiration_date,
            }

    # Refresh WHOIS when expiry is missing or the cache is outdated.
    try:
        import whois

    except ImportError:
        whois = None
        print(
            "WHOIS dependency missing. Install with "
            "'python -m pip install python-whois'."
        )

    if whois is not None:
        try:
            try:
                result = whois.whois(
                    domain,
                    timeout=REQUEST_TIMEOUT,
                )

            except TypeError:
                result = whois.whois(domain)

            new_registration = parse_whois_datetime(
                getattr(result, "creation_date", None)
            )

            new_expiration = parse_whois_datetime(
                getattr(result, "expiration_date", None)
            )

            # Keep an existing valid registration date if the
            # refreshed WHOIS response does not include one.
            if new_registration is not None:
                registration_date = new_registration

            if new_expiration is not None:
                expiration_date = new_expiration

            CACHE["whois"][domain] = {
                "checked_at": utc_now().isoformat(),
                "registration": (
                    registration_date.isoformat()
                    if registration_date else None
                ),
                "expiration": (
                    expiration_date.isoformat()
                    if expiration_date else None
                ),
                "status": (
                    "success"
                    if registration_date or expiration_date
                    else "no_date"
                ),
            }

            save_cache(CACHE)

        except Exception as error:
            print(f"WHOIS lookup failed for {domain}: {error}")

    # RDAP is only a fallback for a missing WHOIS expiry date.
    if expiration_date is None:
        print(
            f"WHOIS expiry unavailable for {domain}; "
            "trying RDAP for expiry only."
        )

        try:
            rdap_data = get_rdap_data(domain)

            rdap_expiration = (
                rdap_data.get("expiration")
                if rdap_data else None
            )

            if rdap_expiration is not None:
                expiration_date = rdap_expiration

                print(
                    f"RDAP fallback expiry for {domain}: "
                    f"{expiration_date}"
                )

            else:
                print(
                    f"RDAP did not provide an expiry date for {domain}."
                )

        except Exception as error:
            print(
                f"RDAP expiry fallback failed for {domain}: {error}"
            )

        # Save the WHOIS registration date and the expiry obtained
        # from WHOIS or RDAP. RDAP registration is not substituted.
        CACHE["whois"][domain] = {
            "checked_at": utc_now().isoformat(),
            "registration": (
                registration_date.isoformat()
                if registration_date else None
            ),
            "expiration": (
                expiration_date.isoformat()
                if expiration_date else None
            ),
            "status": (
                "success"
                if registration_date or expiration_date
                else "no_date"
            ),
            "expiry_source": (
                "rdap_fallback"
                if expiration_date else None
            ),
        }

        save_cache(CACHE)

    return {
        "registration": registration_date,
        "expiration": expiration_date,
    }


# ============================================================
# Registration date display metadata
# Only manual .nz scans display this date.
# ============================================================

def get_registration_metadata(domain, source):
    extracted = get_extracted_domain(domain)

    if (
        not is_manual_source(source)
        or extracted.suffix.lower() != "nz"
    ):
        return None

    whois_data = get_whois_data(domain, source)

    if not whois_data:
        return None

    registration_date = whois_data.get("registration")

    if not registration_date:
        return None

    return registration_date.date().isoformat()


# ============================================================
# Feature 3 — Domain Length
# ============================================================

def calculate_domain_length(domain):
    return len(get_extracted_domain(domain).domain)


# ============================================================
# Feature 4 — Number of Hyphens
# ============================================================

def calculate_num_hyphens(domain):
    return get_hostname(domain).count("-")


# ============================================================
# Feature 5 — Number of Digits
# ============================================================

def calculate_num_digits(domain):
    main_domain = get_extracted_domain(domain).domain

    return sum(
        character.isdigit()
        for character in main_domain
    )


# ============================================================
# Feature 6 — Shannon Entropy
# ============================================================

def calculate_entropy(domain):
    main_domain = get_extracted_domain(domain).domain

    if not main_domain:
        return 0.0

    counts = Counter(main_domain)
    length = len(main_domain)

    return -sum(
        (count / length) * math.log2(count / length)
        for count in counts.values()
    )


# ============================================================
# Feature 7 — Brand Keyword
# ============================================================

def calculate_brand_keyword(domain):
    """
    Detect brand keywords without treating an exact brand-name
    match as suspicious by itself.
    """
    main_domain = get_extracted_domain(domain).domain.lower()

    if not main_domain:
        return 0

    brands = {
        brand.strip().lower()
        for brand in BRAND_KEYWORDS
        if brand and brand.strip()
    }

    # An exact brand match alone is not a phishing signal.
    if main_domain in brands:
        return 0

    return int(
        any(brand in main_domain for brand in brands)
    )


# ============================================================
# Feature 8 — Typosquatting Similarity
# ============================================================

def calculate_typosquatting_score(domain):
    """
    Compare the full extracted domain label with brand keywords.
    An exact brand-name match does not count as typosquatting.
    """
    main_domain = get_extracted_domain(domain).domain.lower()

    if not main_domain:
        return 0.0

    best_score = 0.0

    for brand in BRAND_KEYWORDS:
        brand = brand.strip().lower()

        if not brand:
            continue

        # Do not treat an exact brand match as a typo.
        if main_domain == brand:
            continue

        score = SequenceMatcher(
            None,
            main_domain,
            brand,
        ).ratio()

        best_score = max(best_score, score)

    return round(best_score, 3)


# ============================================================
# Feature 9 — SSL Certificate Age
# ============================================================

def get_ssl_certificate_date(domain):
    hostname = get_hostname(domain)
    cached = CACHE["ssl"].get(hostname)

    if cached and is_cache_fresh(
        cached.get("checked_at"),
        SSL_CACHE_TTL,
    ):
        return parse_iso_datetime(
            cached.get("not_before")
        )

    context = ssl.create_default_context()

    for attempt in range(MAX_RETRIES + 1):
        try:
            with socket.create_connection(
                (hostname, HTTPS_PORT),
                timeout=REQUEST_TIMEOUT,
            ) as sock:

                with context.wrap_socket(
                    sock,
                    server_hostname=hostname,
                ) as secure_socket:

                    certificate = secure_socket.getpeercert()
                    not_before = certificate.get("notBefore")

                    if not not_before:
                        raise ValueError(
                            "Certificate has no notBefore field"
                        )

                    certificate_date = datetime.strptime(
                        not_before,
                        "%b %d %H:%M:%S %Y %Z",
                    ).replace(tzinfo=timezone.utc)

                    CACHE["ssl"][hostname] = {
                        "checked_at": utc_now().isoformat(),
                        "not_before": certificate_date.isoformat(),
                        "status": "success",
                    }

                    save_cache(CACHE)
                    return certificate_date

        except (
            socket.timeout,
            TimeoutError,
            ConnectionError,
        ) as error:

            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
                continue

            print(
                f"SSL connection failed for {hostname}: {error}"
            )

        except (
            socket.gaierror,
            ssl.SSLError,
            OSError,
            ValueError,
        ) as error:

            print(f"SSL lookup failed for {hostname}: {error}")
            break

    CACHE["ssl"][hostname] = {
        "checked_at": utc_now().isoformat(),
        "not_before": None,
        "status": "failed",
    }

    save_cache(CACHE)
    return None


def calculate_ssl_certificate_age(domain):
    certificate_date = get_ssl_certificate_date(domain)

    if not certificate_date:
        return None

    return max(
        (utc_now() - certificate_date).days,
        0,
    )


# ============================================================
# Feature 10 — TLD
# ============================================================

def calculate_tld(domain):
    return get_extracted_domain(domain).suffix


# ============================================================
# Main Feature Extraction
# ============================================================

def extract_features(domain, source=None):
    """
    Manual scans:
      - WHOIS is the primary source.
      - RDAP supplies only a missing expiry date.

    Automated/OpenSquat scans:
      - RDAP only.

    The original ten model feature names remain unchanged.
    """

    print(f"\nExtracting features for: {domain}")

    # Local features
    domain_length = calculate_domain_length(domain)
    num_hyphens = calculate_num_hyphens(domain)
    num_digits = calculate_num_digits(domain)
    entropy_domain = calculate_entropy(domain)
    brand_keyword = calculate_brand_keyword(domain)
    typosquatting_score = calculate_typosquatting_score(domain)
    tld = calculate_tld(domain)

    # Registration features
    if is_manual_source(source):
        registration_data = get_whois_data(domain, source)

        domain_age = calculate_age_from_registration_date(
            registration_data.get("registration")
            if registration_data else None
        )

        registration_period = calculate_registration_period(
            registration_data
        )

        # Diagnostic output
        print("SCAN SOURCE:", source)

        print(
            "WHOIS REGISTRATION:",
            registration_data.get("registration")
            if registration_data else None,
        )

        print(
            "WHOIS EXPIRATION:",
            registration_data.get("expiration")
            if registration_data else None,
        )

        print("REGISTRATION PERIOD:", registration_period)

    else:
        registration_data = get_rdap_data(domain)

        domain_age = calculate_domain_age(registration_data)

        registration_period = calculate_registration_period(
            registration_data
        )

        print("SCAN SOURCE:", source)

        print(
            "RDAP REGISTRATION:",
            registration_data.get("registration")
            if registration_data else None,
        )

        print(
            "RDAP EXPIRATION:",
            registration_data.get("expiration")
            if registration_data else None,
        )

        print("REGISTRATION PERIOD:", registration_period)

    # SSL feature
    ssl_certificate_age = calculate_ssl_certificate_age(domain)

    # Keep all ten original ML feature names unchanged.
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
        "tld": tld,
    }


# ============================================================
# Local test
# ============================================================

if __name__ == "__main__":
    features = extract_features(
        "www.anz.co.nz",
        source="manual",
    )

    print("\nFeature results:")

    for feature, value in features.items():
        print(f"{feature}: {value}")
