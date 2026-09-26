from pathlib import Path
import os
import shutil
import subprocess
import random


# ============================================================
# PROJECT DIRECTORIES
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "opensquat"

KEYWORDS_FILE = DATA_DIR / "brands_keywords.txt"
RESULTS_FILE = OUTPUT_DIR / "results.txt"

CANDIDATE_FILE = OUTPUT_DIR / "candidate_domains.txt"
USED_DOMAINS_FILE = OUTPUT_DIR / "used_domains.txt"


# ============================================================
# SETTINGS
# ============================================================

MAX_DOMAINS = 50


# ============================================================
# FIND OPEN SQUAT
# ============================================================

def find_opensquat():
    """Find the OpenSquat executable available in the current environment."""

    opensquat_path = shutil.which("opensquat")

    if not opensquat_path:
        raise RuntimeError(
            "OpenSquat was not found. Make sure the virtual environment "
            "containing OpenSquat is active."
        )

    return opensquat_path


# ============================================================
# RUN OPEN SQUAT
# ============================================================

def run_opensquat():
    """Run OpenSquat and save its results."""

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    opensquat_path = find_opensquat()

    command = [
        opensquat_path,
        "-k",
        str(KEYWORDS_FILE),
        "-o",
        str(RESULTS_FILE),
    ]

    print("Starting OpenSquat...")
    print(f"Keywords: {KEYWORDS_FILE}")
    print(f"Output:   {RESULTS_FILE}")
    print()

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"

    result = subprocess.run(
        command,
        cwd=BASE_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
    )

    print(result.stdout)

    if result.returncode != 0:
        print(result.stderr)

        raise RuntimeError(
            f"OpenSquat exited with code {result.returncode}"
        )


# ============================================================
# LOAD PREVIOUSLY USED DOMAINS
# ============================================================

def load_used_domains():
    """Load domains that have already been shown in previous runs."""

    used_domains = set()

    if not USED_DOMAINS_FILE.exists():
        return used_domains

    with USED_DOMAINS_FILE.open("r", encoding="utf-8") as file:
        for line in file:
            domain = line.strip().lower()

            if domain:
                used_domains.add(domain)

    return used_domains


# ============================================================
# READ NEW DOMAINS
# ============================================================

def read_new_domains():
    """
    Read OpenSquat results and return up to MAX_DOMAINS
    domains that have not been shown before.
    """

    if not RESULTS_FILE.exists():
        raise FileNotFoundError(
            f"OpenSquat result file was not created: {RESULTS_FILE}"
        )

    used_domains = load_used_domains()

    domains = []
    seen_this_run = set()

    with RESULTS_FILE.open("r", encoding="utf-8") as file:

        for line in file:

            domain = line.strip()

            if not domain:
                continue

            domain_key = domain.lower()

            # Skip domains already used in previous runs
            if domain_key in used_domains:
                continue

            # Skip duplicates inside the current OpenSquat results
            if domain_key in seen_this_run:
                continue

            seen_this_run.add(domain_key)
            domains.append(domain)

    # Randomize the unused domains so we don't always
    # select them in exactly the same order.
    random.shuffle(domains)

    # Keep only the maximum allowed number.
    selected_domains = domains[:MAX_DOMAINS]

    return selected_domains


# ============================================================
# SAVE CURRENT CANDIDATES
# ============================================================

def save_candidate_domains(domains):
    """Save the current batch of candidate domains."""

    with CANDIDATE_FILE.open("w", encoding="utf-8") as file:

        for domain in domains:
            file.write(domain + "\n")


# ============================================================
# SAVE USED DOMAIN HISTORY
# ============================================================

def save_used_domains(domains):
    """Add the current batch to the used-domain history."""

    with USED_DOMAINS_FILE.open("a", encoding="utf-8") as file:

        for domain in domains:
            file.write(domain.lower() + "\n")


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("==========================================")
    print(" THREAT HUNTER - OPENSQUAT SCANNER")
    print("==========================================")
    print()

    # Run OpenSquat
    run_opensquat()

    # Select new domains
    domains = read_new_domains()

    # Save current 50-domain batch
    save_candidate_domains(domains)

    # Remember them so they are not shown again
    save_used_domains(domains)

    print()
    print("==========================================")
    print(" OPEN SQUAT COMPLETED")
    print("==========================================")
    print()

    print(f"New domains collected: {len(domains)}")
    print(f"Maximum allowed:       {MAX_DOMAINS}")
    print(f"Candidate file:        {CANDIDATE_FILE}")
    print(f"History file:          {USED_DOMAINS_FILE}")

    print()

    if len(domains) < MAX_DOMAINS:
        print(
            "WARNING: Fewer than 50 unused domains were available "
            "in this OpenSquat result."
        )

    print("First 10 new domains:")

    for domain in domains[:10]:
        print(f"- {domain}")

    print()

    print("==========================================")
    print(" COMPLETED")
    print("==========================================")


if __name__ == "__main__":
    main()