import pandas as pd 
from sklearn.model_selection import train_test_split

df = pd.read_csv('Training:Testing Dataset.csv')  # Load the CSV file containing domain names and labels

# Define the feature columns to be used for training the model
#This list contains the names of the columns in the DataFrame that will be used as features for training the machine learning model. These features are selected based on their relevance to the task of detecting phishing domains.
feature_columns = ['domain_length', 'num_hyphens', 'entropy_domain', 'domain_age_days', 'expiration_days', 'is_suspicious_tld', 'Num_Digits', 'Contains_Brand_Keyword', 'Typosquat_Similarity', 'SSL_Cert_Age_Days']

# Split the dataset into features (X) and labels (y)
x = df[feature_columns]  # Features
y = df['label']  # Labels

# Split the data into training and testing sets (80% training, 20% testing)
#Using stratified sampling to ensure that the distribution of labels is similar in both the training and testing sets
X_train, X_test, y_train, y_test = train_test_split(x, y, test_size=0.2, stratify=y, random_state=42) 

# Print the sizes of the training and testing sets, as well as the distribution of labels in each set
print(f"Training set size:", X_train.shape)
print(f"Testing set size:", X_test.shape)
print(y_train.value_counts())
print(y_test.value_counts())

# Save the training and testing sets to CSV files for later use
X_train.to_csv('X_train.csv', index=False) #X_train.csv contains the features for the training set, without the index column
X_test.to_csv('X_test.csv', index=False) #X_test.csv contains the features for the testing set, without the index column
y_train.to_csv('y_train.csv', index=False)#y_train.csv contains the labels for the training set, without the index column
y_test.to_csv('y_test.csv', index=False)#y_test.csv contains the labels for the testing set, without the index column

print("Saved: DataSplit(80:20)Dataset.csv")