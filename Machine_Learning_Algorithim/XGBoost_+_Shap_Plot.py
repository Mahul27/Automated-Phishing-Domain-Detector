import pandas as pd 
import joblib
import shap 
import matplotlib 
matplotlib.use('Agg')  # Use 'Agg' backend for non-interactive plotting
import matplotlib.pyplot as plt

model = joblib.load('phishing_domain_model.pk1') # Load the trained XGBoost model from the file
X_test = pd.read_csv('X_test.csv') # Load the test data from the CSV file into a pandas DataFrame

explainer = shap.TreeExplainer(model) # Create a SHAP explainer object for the XGBoost model

def explain_predicition(domain_features_row):
    risk_score = float(model.predict_proba(domain_features_row)[0][1] * 100) # Get the predicted probability for the positive class (1) from the model
    shap_values = explainer.shap_values(domain_features_row) # Calculate the SHAP values for the selected domain using the explainer object

    feature_contributions = []
    for feature_name, shap_value, feature_value in zip(
        domain_features_row.columns, shap_values[0], domain_features_row.iloc[0]
    ):
        feature_contributions.append({
            "feature_name": feature_name,
            "feature_value": float(feature_value),
            "shap_value": float(shap_value),
            "contribution_direction": "increases" if shap_value > 0 else "decreases",
        })
    feature_contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True) # Sort the contributions list in descending order based on the absolute value of the SHAP values

    return { 
        "risk_score": risk_score,
        "feature_contributions": feature_contributions,
        "shap_values_row": shap_values,
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
    print(f"Feature: {fc['feature_name']}, Value: {fc['feature_value']:.4f}, SHAP Value: {fc['shap_value']:.4f}, This feature {fc['contribution_direction']} the risk score.") # Print the feature name, value, SHAP value, and contribution direction

plot_path = save_shap_waterfall_plot(one_domain, "shap_waterfall.png") # Call the save_shap_waterfall_plot function to generate and save the SHAP waterfall plot
print(f"SHAP waterfall plot saved to: {plot_path}") # Print the path where the SHAP waterfall plot has been saved