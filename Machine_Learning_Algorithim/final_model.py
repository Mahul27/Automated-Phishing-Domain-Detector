import pandas as pd 
import joblib
import json 
from xgboost import XGBClassifier

X_train = pd.read_csv('X_train.csv') # Load training features   
Y_train = pd.read_csv('Y_train.csv') # Load training labels

# Define the XGBoost model with the best hyperparameters found from hyperparameter tuning
model = XGBClassifier(

    random_state=42, # Set the random seed for reproducibility
    subsample=0.8,# This is used to set the fraction of samples to be used for fitting the individual base learners
    n_estimators=400,# This is used to set the number of trees in the forest, because the model was trained with 400 trees, which is a good balance between performance and training time
    max_depth=11,# Set the maximum depth of the tree, because the model was trained with a maximum depth of 11, which is a good balance between performance and overfitting
    learning_rate=0.01,# Set the learning rate of the model, because the model was trained with a learning rate of 0.01, which is a good balance between performance and training time
    colsample_bytree=0.6,# Set the fraction of features to be used for fitting the individual base learners, because the model was trained with a colsample_bytree of 0.6, which is a good balance between performance and overfitting
) 


model.fit(X_train, Y_train) # Fit the model to the training data

joblib.dump(model, 'phishing_domain_model.pk1') # Save the trained model to a file using joblib

# Save model metadata to a JSON file
model_metadata = {
    "model_type": "XGBClassifier",
    "features_order": list(X_train.columns), # Save the order of features in the training data
    "classifcation_threshold": 0.5,  # Default classification threshold
    # Add a note about the threshold adjustment
    "threshold_adjustment_info":( 
        "I've set the default threshold since the model was trained with a default threshold of 0.5. It produced a false positive rate of 9%, but it achieved results of Recall of 87% which meets the requirement of 85% Recall."
    ),
    "expected_performance": {
    "precision": 0.90625,
    "recall": 0.87,
    "f1_score": 0.8877661020408163,
    "roc_auc": 0.9407,
    "true_negatives": 91,
    "false_positives": 9,
    "false_negatives": 13,
    "true_positives": 87,
    },
}
# Save the model metadata to a JSON file
with open('phishing_domain_model_metadata.json', 'w') as f: # Save the model metadata to a JSON file
    json.dump(model_metadata, f, indent=4) # Save the model metadata to a JSON file with indentation for better readability

print("Model and metadata saved successfully!") # Print a message indicating that the model and metadata have been saved successfully
print("Metadata saved to phishing_domain_model_metadata.json") # Print a message indicating where the metadata has been saved
print("\n features order saved to phishing_domain_model_metadata.json") # Print a message indicating where the features order has been saved
for i, feature in enumerate(X_train.columns, start=1): # Print the order of features in the training data
   print(f"{i}. {feature}") # Print the feature name with its corresponding order number
