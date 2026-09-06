import pandas as pd
from pathlib import Path
import tldextract
import requests
from datetime import datetime

# below code describes the File locations

input_file = Path("../Dataset/Dataset_.csv")
output_file = Path("../Dataset/Registration_Period_data.csv")

# below code will Read dataset

df = pd.read_csv(input_file)

# the below code Extract domain from URL

def get_domain(url):

    extracted = tldextract.extract(str(url))

    if extracted.domain and extracted.suffix:
        return f"{extracted.domain}.{extracted.suffix}"

    return extracted.domain

# below code Get the registration and expiration datesby using the RDAP

def get_registration_period(url):

    domain = get_domain(url)

    if not domain:
        return None

    try:

        response = requests.get(
            f"https://rdap.org/domain/{domain}",
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

        registration_date = None
        expiration_date = None

        # below code Reads RDAP events
        
        for event in data.get("events", []):

            action = event.get("eventAction")
            date = event.get("eventDate")

            if action == "registration":
                registration_date = date

            elif action == "expiration":
                expiration_date = date

            # Check if both the dates exist or not using if statment
    

        if not registration_date or not expiration_date:

            print(
                f"Registration/expiration date unavailable "
                f"for {domain}"
            )

            return None

        # Convert dates
        

        registration_date = datetime.fromisoformat(
            registration_date.replace("Z", "+00:00")
        )

        expiration_date = datetime.fromisoformat(
            expiration_date.replace("Z", "+00:00")
        )

        # Calculate registration period
        
        registration_period = (
            expiration_date - registration_date
        ).days

        return registration_period

    except requests.RequestException as error:

        print(
            f"RDAP request failed for "
            f"{domain}: {error}"
        )

        return None

    except ValueError as error:

        print(
            f"Could not process dates for "
            f"{domain}: {error}"
        )

        return None


# Apply feature extraction

df["Registration_Period_Days"] = df["url"].apply(
    get_registration_period
)

# Display results

print(
    df[
        [
            "url",
            "Registration_Period_Days"
        ]
    ]
)

# Save result
df.to_csv(
    output_file,
    index=False
)

print(
    "\nSaved: Registration_Period_data.csv"
)
