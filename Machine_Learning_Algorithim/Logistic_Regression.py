import pandas as pd
from sklearn.linear_model import LogisticRegression #This is used to import the LogisticRegression class from the sklearn.linear_model module
from sklearn.preprocessing import StandardScaler #This is used to import the StandardScaler class from the sklearn.preprocessing module

# Load the dataset
X_train = pd.read_csv('X_train.csv')
X_test = pd.read_csv('X_test.csv')
Y_train = pd.read_csv('Y_train.csv')['label'] #The target variable is in the 'Label' column
Y_test = pd.read_csv('Y_test.csv')['label']


scaler = StandardScaler()#This is used to standardize the features by removing the mean and scaling to unit variance
X_train_scaled = scaler.fit_transform(X_train) #This is used to fit the scaler to the training data and then transform it
X_test_scaled = scaler.transform(X_test)

model = LogisticRegression() #This is used to create an instance of the LogisticRegression class

model.fit(X_train_scaled, Y_train) #This is used to fit the model to the training data

print("Model trained successfully!")
print("Training Accuracy:", model.score(X_train_scaled, Y_train)) #This is used to print the training accuracy of the model