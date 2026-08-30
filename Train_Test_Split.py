import pandas as pd 
from sklearn.model_selection import train_test_split

df = pd.read_csv('')  # Load the CSV file containing domain names and labels

feature_columns = ['domain_length', 'num_hyphens', 'entropy_domain', 'domain_age_days', 'expiration_days', 'is_suspicious_tld', 'num_digits', 'contains_brand_keyword', 'typosquat_similarity', 'ssl_cert_age_days']

x = df[feature_columns]  # Features
y = df['label']  # Labels

X_train, X_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)  # Split the data into training and testing sets

print(f"Training set size:", X_train.shape)
print(f"Testing set size:", X_test.shape)
print(y_train.value_counts())
print(y_test.value_counts())


