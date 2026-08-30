import pandas as pd
from pathlib import Path
import tldextract

# File locations

input_file = Path("../Dataset/Dataset_.csv")
output_file = Path("../Dataset/TLD_data.csv")

# Read dataset

df = pd.read_csv(input_file)

# Extract TLD

def get_tld(url):

    extracted = tldextract.extract(str(url))

    return extracted.suffix

# Apply feature extraction

df["TLD"] = df["url"].apply(get_tld)

# Display results

print(df[["url", "TLD"]])

# Save result
df.to_csv(output_file, index=False)

print("\nSaved: TLD_data.csv")