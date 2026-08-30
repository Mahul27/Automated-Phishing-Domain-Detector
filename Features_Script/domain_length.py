import pandas as pd
from pathlib import Path
import tldextract


# File locations


input_file = Path("../Dataset/Dataset_.csv")
output_file = Path("../Dataset/Domain_Length_data.csv")


# Read the dataset

df = pd.read_csv(input_file)

# Extract domain from URL


def get_domain(url):
    extracted = tldextract.extract(str(url))
    
    if extracted.domain and extracted.suffix:
        return f"{extracted.domain}.{extracted.suffix}"
    
    return extracted.domain


# Calculate domain length


def get_domain_length(url):
    domain = get_domain(url)
    return len(domain)


# Apply feature extraction


df["Domain_Length"] = df["url"].apply(get_domain_length)


# Display results


print(df[["url", "Domain_Length"]])


# Save new dataset

df.to_csv(output_file, index=False)

print("\nSaved: Domain_Length_data.csv")