import pandas as pd 
import joblib
import shap 
import matplotlib 
matplotlib.use('Agg')  # Use 'Agg' backend for non-interactive plotting
import matplotlib.pyplot as plt

model = joblib.load('phishing_domain_model.pk1') # Load the trained XGBoost model from the file
X_test = pd.read_csv('X_test.csv') # Load the test data from the CSV file into a pandas DataFrame

explainer = shap.TreeExplainer(model) # Create a SHAP explainer object for the XGBoost model

feature_explanation = { #In this dictionary, each key corresponds to a feature name, and the value is a string explaining what that feature represents and how it may relate to phishing detection.
    "domain_length": "The length of the domain name. Longer domain names may be more suspicious.",
    "num_hyphens": "The number of hyphens in the domain name. More hyphens can indicate a phishing attempt.",
    "Num_Digits": "The number of digits in the domain name. A higher number of digits can be a sign of a phishing domain.",
    "entropy_domain": "The entropy of the domain name. Higher entropy can indicate randomness, which is often associated with phishing domains.",
    "domain_age_days": "The age of the domain in days. Newer domains are often more suspicious.",
    "expiration_days": "The number of days until the domain expires. Domains that are about to expire may be more likely to be malicious.",
    "is_suspicious_tld": "Whether the domain has a suspicious top-level domain (TLD). Certain TLDs are more commonly associated with phishing.",
    "Contains_Brand_Keyword": "Whether the domain contains brand names or keywords. Phishing domains often mimic legitimate brands.",
    "Typosquat_Similarity": "The similarity of the domain to known brand names. Higher similarity can indicate a typosquatting attempt.",
    "SSL_Cert_Age_Days": "The age of the SSL certificate in days. Newer certificates may be more suspicious.",
} 

def explain_predicition(domain_features_row):
    risk_score = float(model.predict_proba(domain_features_row)[0][1] * 100) # Get the predicted probability for the positive class (1) from the model
    shap_values = explainer.shap_values(domain_features_row) # Calculate the SHAP values for the selected domain using the explainer object

    feature_contributions = []
    for feature_name, shap_value, feature_value in zip(
        domain_features_row.columns, shap_values[0], domain_features_row.iloc[0]
    ):
        direction = "increases" if shap_value > 0 else "decreases" # Determine whether the SHAP value increases or decreases the risk score

        feature_contributions.append({
            "feature_name": feature_name,
            "feature_value": float(feature_value),
            "shap_value": float(shap_value),
            "contribution_direction": direction, 
            "explanation": feature_explanation.get(feature_name, "This is the contribution towards the risk assessment")  # Get the explanation for the feature from the dictionary
        })

    feature_contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True) # Sort the contributions list in descending order based on the absolute value of the SHAP values

    return { 
        "risk_score": risk_score,
        "feature_contributions": feature_contributions,
        "base_value": explainer.expected_value,
    }

def save_shap_waterfall_plot(domain_features_row, output_path="shap_waterfall.png"):
    """
    Generate and save a SHAP waterfall plot for the given domain features row.

    """
    shap_values = explainer.shap_values(domain_features_row) # Calculate the SHAP values for the selected domain using the explainer object
    explanation = shap.Explanation(values=shap_values[0], base_values=explainer.expected_value, data=domain_features_row.iloc[0], feature_names=domain_features_row.columns) # Create a SHAP Explanation object

    plt.figure()
    shap.plots.waterfall(explanation, show=False) # Generate the waterfall plot without displaying it
    plt.tight_layout() # Adjust the layout to prevent clipping of labels
    plt.savefig(output_path, dpi=150, bbox_inches='tight') # Save the plot to the specified output path
    plt.close() # Close the plot to free up memory

    return output_path

one_domain = X_test.iloc[[0]] # Select the first row of the test data as a single domain for SHAP value calculation

result = explain_predicition(one_domain) # Call the explain_prediction function to get the risk score and feature contributions
print("Predicted risk score for this domain: {:.2f}%".format(result["risk_score"])) # Print the predicted risk score for the selected domain
print("Feature contibution (most significant first):")
for fc in result["feature_contributions"]: # Iterate through the sorted feature contributions and print them
    print(f"Feature: {fc['feature_name']}, Value: {fc['feature_value']:.4f},  This feature {fc['contribution_direction']} the risk score.") # Print the feature name, value, SHAP value, and contribution direction
    print(f"The reason behind it: {fc['explanation']}") # Print the explanation for the feature

plot_path = save_shap_waterfall_plot(one_domain, "shap_waterfall.png") # Call the save_shap_waterfall_plot function to generate and save the SHAP waterfall plot
print(f"SHAP waterfall plot saved to: {plot_path}") # Print the path where the SHAP waterfall plot has been saved