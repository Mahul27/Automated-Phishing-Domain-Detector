import pandas as pd 
import difflib
import tldextract

df = pd.read_csv('Brand_Keywords_data.csv')  # Load the CSV file containing domain names and brand keyword presence

with open('brands_keywords.txt') as file:
    brands_keywords = [line.strip().lower() for line in file if line.strip()]

def typosquat_similarity(url):
    # Extract the domain name without subdomains and TLD
    extracted = tldextract.extract(str(url))
    domain_name = extracted.domain.lower()  # Get the main domain part and convert to lowercase
    best_score = 0.0
    for brand in brands_keywords:
        brand_length = len(brand)

        if len(domain_name) < brand_length:
            windows = [domain_name]
        else:
            windows = [domain_name[i:i+brand_length] for i in range(len(domain_name) - brand_length + 1)]
        for window in windows:
            score = difflib.SequenceMatcher(None, window, brand).ratio()
            if score > best_score:
                best_score = score
    return round(best_score, 3)

df["Typosquat_Similarity"] = df["url"].apply(typosquat_similarity)  # Apply the function to calculate typosquat similarity for each domain
    
print(df[["url", "Typosquat_Similarity"]])  # Print the DataFrame with the new column showing typosquat similarity for each domain

df.to_csv('Typosquat_Similarity_data.csv', index=False)  # Save the updated DataFrame to a new CSV file
print("\nSaved: Typosquat_Similarity_data.csv with the typosquat similarity for each domain.")
    