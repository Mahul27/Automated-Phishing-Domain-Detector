import pandas as pd
from sklearn.linear_model import LogisticRegression #This is used to import the LogisticRegression class from the sklearn.linear_model module
from sklearn.preprocessing import StandardScaler #This is used to import the StandardScaler class from the sklearn.preprocessing module

#This is used to import the precision_score, recall_score, f1_score, roc_auc_score, and confusion_matrix functions from the sklearn.metrics module
#precision_score: This function is used to calculate the precision of the model, which is the ratio of true positives to the sum of true positives and false positives.
#recall_score: This function is used to calculate the recall of the model, which is the ratio of true positives to the sum of true positives and false negatives.
#f1_score: This function is used to calculate the F1 score of the model, which is the harmonic mean of precision and recall.
#roc_auc_score: This function is used to calculate the ROC AUC score of the model, which is a measure of how well the model can distinguish between the positive and negative classes.
#confusion_matrix: This function is used to calculate the confusion matrix of the model, which is a table that shows the number of true positives, false positives, true negatives, and false negatives.
#roc_curve: This function is used to calculate the false positive rate, true positive rate, and thresholds for the ROC curve of the model.
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix, roc_curve  

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

# Previous code
## print("Model trained successfully!")
## print("Training Accuracy:", model.score(X_train_scaled, Y_train)) #This is used to print the training accuracy of the model

Y_pred = model.predict(X_test_scaled) #This is used to make predictions on the test data of the model of 0 and 1

Y_pred_proba = model.predict_proba(X_test_scaled)[:, 1] #This is used to get the predicted probabilities for the positive class (1) from the model

# NEW CODE FROM ROC_CURVE ---------------------------------------------------------------------------------------------------------------------------------------------------
fpr , tpr, thresholds = roc_curve(Y_test, Y_pred_proba) #This is used to calculate the false positive rate, true positive rate, and thresholds for the ROC curve of the model

target_false_positive_rate = 0.02 #This is used to set the target false positive rate for the model
valid = fpr <= target_false_positive_rate #This is used to get the thresholds that correspond to a false positive rate less than or equal to the target false positive rate

if valid.sum() == 0: #This is used to check if there are any valid thresholds that meet the target false positive rate
    print("No valid thresholds found for the target false positive rate.")

else:
    valid_tpr = tpr[valid] #This is used to get the true positive rates that correspond to the valid thresholds
    valid_fpr = fpr[valid] #This is used to get the false positive rates that correspond to the valid thresholds
    valid_threshold = thresholds[valid] #This is used to get the thresholds that correspond to the valid true positive rates and false positive rates

    best_index = valid_tpr.argmax() #This is used to get the index of the maximum true positive rate that meets the target false positive rate
    best_threshold_value = valid_threshold[best_index] #This is used to get the best threshold value that meets the target false positive rate  

    print("Best threshold value for target false positive rate of 2%:", best_threshold_value) #This is used to print the best threshold value that meets the target false positive rate
    print("True positive rate at best threshold:", valid_tpr[best_index]) #This is used to print the true positive rate at the best threshold that meets the target false positive rate
    print("False positive rate at best threshold:",valid_fpr[best_index]) #This is used to print the false positive rate at the best threshold that meets the target false positive rate

# Make predictions using the best threshold
y_pred_New = (Y_pred_proba >= best_threshold_value).astype(int) #This is used to make predictions on the test data using the best threshold that meets the target false positive rate

# Calculate evaluation metrics using the best threshold
precision_new = precision_score(Y_test, y_pred_New) #This is used to calculate the precision of the model using the best threshold
recall_new = recall_score(Y_test, y_pred_New) #This is used to calculate the recall of the model using the best threshold   
f1_new = f1_score(Y_test, y_pred_New) #This is used to calculate the F1 score of the model using the best threshold
tn_new, fp_new, fn_new, tp_new = confusion_matrix(Y_test, y_pred_New).ravel() #This is used to calculate the confusion matrix of the model using the best threshold and unpack the values into true negatives (tn), false positives (fp), false negatives (fn), and true positives (tp)

print("Evaluation metrics using the best threshold:")
print("Precision:", precision_new) #This is used to print the precision of the model using the best threshold
print("Recall:", recall_new) #This is used to print the recall of the model using the best threshold
print("F1 Score:", f1_new) #This is used to print the F1 score of the model using the best threshold



# Old Threshold -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Calculate evaluation metrics
#precision = precision_score(Y_test, Y_pred) #This is used to calculate the precision of the model
#recall = recall_score(Y_test, Y_pred) #This is used to calculate the recall of the model
#f1 = f1_score(Y_test, Y_pred) #This is used to calculate the F1 score of the model  
#roc_auc = roc_auc_score(Y_test, Y_pred_proba) #This is used to calculate the ROC AUC score of the model

# true negatives (tn), false positives (fp), false negatives (fn), and true positives (tp)
#tn, fp, fn, tp = confusion_matrix(Y_test, Y_pred).ravel() #This is used to calculate the confusion matrix of the model and unpack the values into true negatives (tn), false positives (fp), false negatives (fn), and true positives (tp)

# The reason for calulating the false postives, is tied to the metrirdc of <2% target of a domain being classified as a phishing domain, when it is not.
#This is important because if the model has a high false positive rate, it will classify many legitimate domains as phishing domains, which can lead to a loss of trust in the model and the system as a whole.
#false_positive_rate = fp / (fp + tn) #This is used to calculate the false positive rate of the model

# Print evaluation metrics
#print("Precision:", precision) #This is used to print the precision of the model
#print("Recall:", recall) #This is used to print the recall of the model
#print("F1 Score:", f1) #This is used to print the F1 score of the model
#print("ROC AUC Score:", roc_auc) #This is used to print the ROC AUC score of the model
#print ("False Positive Rate:", false_positive_rate) #This is used to print the false positive rate of the model
#print("True Negatives:", tn) #This is used to print the true negatives of the model
#print("False Positives:", fp) #This is used to print the false positives of the model
#print("False Negatives:", fn) #This is used to print the false negatives of the model
#print("True Positives:", tp) #This is used to print the true positives of the model