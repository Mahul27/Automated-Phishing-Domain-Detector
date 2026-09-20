import pandas as pd 
import joblib 
import shap 

model = joblib.load('phishing_domain_model.pk1') #This is used to load the trained XGBoost model from the xgboost_model.pkl file using joblib
explainer = shap.TreeExplainer(model) #This is used to create a SHAP explainer object for the XGBoost model using the TreeExplainer class from the shap library

X_test = pd.read_csv('X_test.csv') #This is used to load the test data from the X_test.csv file into a pandas DataFrame
one_domain = X_test.iloc[[0]] #This is used to select the first row of the test data as a single domain for SHAP value calculation

print("Calculating SHAP values for the first domain in the test set...") #This is used to print a message indicating that SHAP values are being calculated for the first domain in the test set
print("Feature values for this domain:")
print(one_domain.to_string(index=False)) #This is used to print the feature values for the selected domain
print()

risk_score = float(model.predict_proba(one_domain)[0][1] * 100) #This is used to get the predicted probability for the positive class (1) from the model for the selected domain
print("Predicted risk score for this domain: {:.2f}%".format(risk_score)) #This is used to print the predicted risk score for the selected domain

shap_values = explainer.shap_values(one_domain) #This is used to calculate the SHAP values for the selected domain using the explainer object
print("SHAP values for this domain:")

contributions = [(name, float(value)) for name, value in zip(one_domain.columns, shap_values[0])] #This is used to create a list of tuples containing feature names and their corresponding SHAP values for the selected domain
contributions.sort(key=lambda x: abs(x[1]), reverse=True) #This is used to sort the contributions list in descending order based on the absolute value of the SHAP values

for feature_name, shap_value in contributions: #This is used to iterate through the sorted contributions list and print the feature names and their corresponding SHAP values
    direction = "increases" if shap_value > 0 else "decreases" #This is used to determine whether the SHAP value increases or decreases the risk score
    print(f"Feature: {feature_name}, SHAP Value: {shap_value:.4f}, This feature {direction} the risk score.") #This is used to print the feature name, SHAP value, and whether it increases or decreases the risk score

assert isinstance(risk_score, float), "Risk score should be a float" #This is used to assert that the risk score is a float
assert 0 <= risk_score <= 100, "Risk score should be between 0 and 100" #This is used to assert that the risk score is between 0 and 100    
assert len(contributions) == len(one_domain.columns), "Number of contributions should match number of features" #This is used to assert that the number of contributions matches the number of features in the selected domain

print ("SHAP value calculation completed successfully!") #This is used to print a message indicating that SHAP value calculation has been completed successfully