import pandas as pd
from pathlib import Path
import tldextract
import requests
from datetime import datetime, timezone

# File locations

input_file = Path("../Dataset/Dataset_.csv")
output_file = Path("../Dataset/Domain_Age_data.csv")

# Read dataset

df = pd.read_csv(input_file)

# Extract registrable domain

def get_domain(url):

    extracted = tldextract.extract(str(url))

    if extracted.domain and extracted.suffix:
        return f"{extracted.domain}.{extracted.suffix}"

    return extracted.domain
# Select RDAP server

def get_rdap_url(domain):

    if domain.endswith(".nz"):
        return f"https://rdap.nz/domain/{domain}"

    return f"https://rdap.org/domain/{domain}"
# Get registration date

def get_registration_date(domain):

    rdap_url = get_rdap_url(domain)

    try:

        response = requests.get(
            rdap_url,
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

        for event in data.get("events", []):

            if event.get("eventAction") == "registration":

                return event.get("eventDate")

        return None

    except requests.RequestException as error:

        print(f"RDAP request failed for {domain}: {error}")

        return None

    except ValueError:

        print(f"Invalid RDAP response for {domain}")

        return None

# Calculate domain age

def get_domain_age(url):

    domain = get_domain(url)

    if not domain:
        return None

    registration_date = get_registration_date(domain)

    if not registration_date:
        print(
            f"Registration date unavailable for {domain}"
        )
        return None

    try:

        registration_date = datetime.fromisoformat(
            registration_date.replace("Z", "+00:00")
        )

        current_date = datetime.now(timezone.utc)

        age = current_date - registration_date

        return age.days

    except ValueError:

        print(
            f"Could not read registration date "
            f"for {domain}: {registration_date}"
        )

        return None

# Apply feature extraction

df["Domain_Age_Days"] = df["url"].apply(
    get_domain_age
)

# Display results

print(
    df[
        [
            "url",
            "Domain_Age_Days"
        ]
    ]
)

# Save result

df.to_csv(
    output_file,
    index=False
)

print("\nSaved: Domain_Age_data.csv")