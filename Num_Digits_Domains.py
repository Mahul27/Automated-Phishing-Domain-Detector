import pandas as pd 
import tldextract

df = pd.read_csv('Offical TrainingSet Data for Threat Hunters_sample(1000).csv')  # Load the CSV file containing domain names

def count_digits_in_domain(url):
    # Extract the domain name without subdomains and TLD
    extracted = tldextract.extract(str(url))
    domain_name = extracted.domain  # Get the main domain part
    # Count the number of digits in the domain name
    return sum(char.isdigit() for char in domain_name)
    
df["Num_Digits"] = df["url"].apply(count_digits_in_domain)  # Apply the function to count digits in each domain

print(df[["url", "Num_Digits"]])  # Print the DataFrame with the new column showing the number of digits in each domain

df.to_csv('Num_digits_data.csv', index=False)  # Save the updated DataFrame to a new CSV file
print("\nSaved: Num_digits_data.csv with the number of digits in each domain.")