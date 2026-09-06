import pandas as pd
from pathlib import Path
from urllib.parse import urlparse


# File locations
input_file = Path("../Dataset/Dataset_.csv")
output_file = Path("../Dataset/Number_of_Hyphens_data.csv")


# Read the dataset
df = pd.read_csv(input_file)


# Extract hostname from URL
def get_hostname(url):
    parsed_url = urlparse(str(url))
    return parsed_url.hostname or ""


# Count the number of hyphens
def get_hyphen_count(url):
    hostname = get_hostname(url)
    return hostname.count("-")


# Apply the feature to every URL
df["Number_of_Hyphens"] = df["url"].apply(get_hyphen_count)


# Display results
print(df[["url", "Number_of_Hyphens"]])


# Save the results
df.to_csv(output_file, index=False)

print("\nSaved: Number_of_Hyphens_data.csv")