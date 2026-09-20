import pandas as pd
from xgboost import XGBClassifier
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, roc_auc_score, roc_curve, make_scorer
from sklearn.model_selection import RandomizedSearchCV

# Load the training and test data
X_train = pd.read_csv('X_train.csv') #This is used to load the training data from the X_train.csv file into a pandas DataFrame
X_test = pd.read_csv('X_test.csv') #This is used to load the test data from the X_test.csv file into a pandas DataFrame
Y_train = pd.read_csv('Y_train.csv')['label'] #This is used to load the target variable from the Y_train.csv file into a pandas Series
Y_test = pd.read_csv('Y_test.csv')['label'] #This is used to load the target variable from the Y_test.csv file into a pandas Series

def partial_auc_score(y_true, y_score, max_fpr=0.02):
    return roc_auc_score(y_true, y_score, max_fpr=max_fpr)
    

custom_scorer = make_scorer(partial_auc_score,response_method='predict_proba')

param_distributions = {
    'n_estimators': [100, 200, 300, 400, 500],
    'max_depth': [3, 5, 7, 9, 11],
    'learning_rate': [0.01, 0.05, 0.1, 0.2],
    'subsample': [0.6, 0.8, 1.0],
    'colsample_bytree': [0.6, 0.8, 1.0],
}

base_model = XGBClassifier(random_state=42)

random_search = RandomizedSearchCV(estimator=base_model, param_distributions=param_distributions, n_iter=10, cv=5, scoring=custom_scorer, random_state=42)

random_search.fit(X_train, Y_train)

print("Best hyperparameters found: ", random_search.best_params_)
print("Best recall at target FPR found: ", random_search.best_score_)

base_model = random_search.best_estimator_ 

Y_pred = base_model.predict(X_test) #This is used to make predictions on the test data of the best model
Y_pred_proba = base_model.predict_proba(X_test)[:, 1] #This is used to get the predicted probabilities for the positive class (1) from the best model

precision = precision_score(Y_test, Y_pred) #This is used to calculate the precision of the best model
recall = recall_score(Y_test, Y_pred) #This is used to calculate the recall of the best model
f1 = f1_score(Y_test, Y_pred) #This is used to calculate the F1 score of the best model
roc_auc = roc_auc_score(Y_test, Y_pred_proba) #This is used to calculate the ROC AUC score of the best model

tn, fp, fn, tp = confusion_matrix(Y_test, Y_pred).ravel() #This is used to calculate the confusion matrix of the best model and unpack the values into true negatives (tn), false positives (fp), false negatives (fn), and true positives (tp)
false_positive_rate = fp / (fp + tn) #This is used to calculate the false positive rate of the best model

print("-------------------------------------------------")
print("XGBoost Evaluation metrics (Tuned):")
print("Precision:", precision) #This is used to print the precision of the best model
print("Recall:", recall) #This is used to print the recall of the best model
print("F1 Score:", f1) #This is used to print the F1 score of the best model
print("ROC AUC Score:", roc_auc) #This is used to print the ROC AUC score of the best model
print("True Negatives (TN):", tn) #This is used to print the number of true negatives of the best model
print("False Positives (FP):", fp) #This is used to print the number of false positives of the best model
print("False Negatives (FN):", fn) #This is used to print the number of false negatives of the best model
print("True Positives (TP):", tp) #This is used to print the number of true positives of the best model

fpr, tpr, thresholds = roc_curve(Y_test, Y_pred_proba) #This is used to calculate the false positive rate, true positive rate, and thresholds for the ROC curve of the best model

target_false_positive_rate = 0.02 #This is used to set the target false positive rate for the best model
valid = fpr <= target_false_positive_rate #This is used to get the thresholds that correspond to a false positive rate less than or equal to the target false positive rate

if valid.sum() == 0: #This is used to check if there are any valid thresholds that meet the target false positive rate
     print("No valid thresholds found for the target false positive rate.") 
else:
    valid_tpr = tpr[valid]
    valid_fpr = fpr[valid]
    valid_threshold = thresholds[valid]

    best_index = valid_tpr.argmax()
    best_threshold_value = valid_threshold[best_index]

    print("-------------------------------------------------")
    print("Best threshold value for target false positive rate of 2%:", best_threshold_value)
    print("True positive rate at best threshold:", valid_tpr[best_index])
    print("False positive rate at best threshold:", valid_fpr[best_index])

    Y_pred_tuned = (Y_pred_proba >= best_threshold_value).astype(int)
    precision_tuned = precision_score(Y_test, Y_pred_tuned)
    recall_tuned = recall_score(Y_test, Y_pred_tuned)
    f1_tuned = f1_score(Y_test, Y_pred_tuned)
    tn_tuned, fp_tuned, fn_tuned, tp_tuned = confusion_matrix(Y_test, Y_pred_tuned).ravel()

    print("-------------------------------------------------")
    print("Evaluation metrics after tuning:")
    print("Precision:", precision_tuned)
    print("Recall:", recall_tuned)
    print("F1 Score:", f1_tuned)
    print("True Negatives (TN):", tn_tuned)
    print("False Positives (FP):", fp_tuned)
    print("False Negatives (FN):", fn_tuned)
    print("True Positives (TP):", tp_tuned)







        

