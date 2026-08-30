import pandas as pd
from pathlib import Path
import tldextract

# File locations

input_file = Path("../Dataset/Dataset_.csv")
output_file = Path("../Dataset/Hyphen_Count_data.csv")

# Read dataset

df = pd.read_csv(input_file)

# Extract domain from URL

def get_domain(url):
    extracted = tldextract.extract(str(url))

    if extracted.domain and extracted.suffix:
        return f"{extracted.domain}.{extracted.suffix}"

    return extracted.domain

# Count hyphens

def get_hyphen_count(url):
    domain = get_domain(url)
    return domain.count("-")

# Apply feature extraction

df["Number_of_Hyphens"] = df["url"].apply(get_hyphen_count)

# Display results

print(df[["url", "Number_of_Hyphens"]])

# Save result

df.to_csv(output_file, index=False)

print("\nSaved: Hyphen_Count_data.csv")