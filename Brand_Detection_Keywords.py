import pandas as pd
import tldextract

df = pd.read_csv('Num_digits_data.csv')  # Load the CSV file containing domain names

with open('brands_keywords.txt') as file:
    brands_keywords = [line.strip().lower() for line in file if line.strip()]

def contains_brand_keyword(url):
    # Extract the domain name without subdomains and TLD
    extracted = tldextract.extract(str(url))
    domain_name = extracted.domain.lower()  # Get the main domain part and convert to lowercase
    matched = [brand for brand in brands_keywords if brand in domain_name]
    # Check if any brand keyword is present in the domain name
    return 1 if matched else 0

df["Contains_Brand_Keyword"] = df["url"].apply(contains_brand_keyword)  # Apply the function to check for brand keywords in each domain

print(df[["url", "Contains_Brand_Keyword"]])  # Print the DataFrame with the new column showing if a brand keyword is present in each domain

df.to_csv('Brand_Keywords_data.csv', index=False)  # Save the updated DataFrame to a new CSV file
print("\nSaved: Brand_Keywords_data.csv with the presence of brand keywords in each domain.")