import pandas as pd
from pathlib import Path
import tldextract
import math
from collections import Counter

# File locations

input_file = Path("../Dataset/Dataset_.csv")
output_file = Path("../Dataset/Shannon_Entropy_data.csv")

# Read dataset

df = pd.read_csv(input_file)

# Extract domain from URL

def get_domain(url):
    extracted = tldextract.extract(str(url))

    if extracted.domain and extracted.suffix:
        return f"{extracted.domain}.{extracted.suffix}"

    return extracted.domain

# Calculate Shannon Entropy

def calculate_entropy(domain):

    if not domain:
        return 0

    character_counts = Counter(domain)
    total_characters = len(domain)

    entropy = 0

    for count in character_counts.values():

        probability = count / total_characters

        entropy -= probability * math.log2(probability)

    return entropy

# Apply feature extraction

df["Shannon_Entropy"] = df["url"].apply(
    lambda url: calculate_entropy(get_domain(url))
)

# Display results

print(df[["url", "Shannon_Entropy"]])

# Save result

df.to_csv(output_file, index=False)

print("\nSaved: Shannon_Entropy_data.csv")