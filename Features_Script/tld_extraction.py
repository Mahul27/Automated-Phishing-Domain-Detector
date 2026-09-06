import pandas as pd
from pathlib import Path
import tldextract

# Belown is the code used to describe the dataset File locations

input_file = Path("../Dataset/Dataset_.csv")
output_file = Path("../Dataset/TLD_data.csv")

# This code will be used to read dataset

df = pd.read_csv(input_file)

# Below code will extract TLD

def get_tld(url):

    extracted = tldextract.extract(str(url))

    return extracted.suffix

# Below code will be used to Apply feature extraction

df["TLD"] = df["url"].apply(get_tld)

# This will display the results

print(df[["url", "TLD"]])

# and lastly this will save the results in CSV file in the designated folder. 
df.to_csv(output_file, index=False)

print("\nSaved: TLD_data.csv")