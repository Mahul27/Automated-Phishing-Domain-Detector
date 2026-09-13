import pandas as pd
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, roc_auc_score, roc_curve
from lightgbm import LGBMClassifier

X_train = pd.read_csv('X_train.csv') #This is used to load the training data from the X_train.csv file into a pandas DataFrame
X_test = pd.read_csv('X_test.csv') #This is used to load the test data from the X_test.csv file into a pandas DataFrame
Y_train = pd.read_csv('Y_train.csv')['label'] #This is used to load the target variable from the Y_train.csv file into a pandas Series
Y_test = pd.read_csv('Y_test.csv')['label'] #This is used to load the target variable from the Y_test.csv file into a pandas Series 

# Create and train the models
RandomForest_model = RandomForestClassifier(random_state=42) #This is used to create an instance of the RandomForestClassifier class
LightGBM_model = LGBMClassifier(random_state=42, verbose=-1) #This is used to create an instance of the LGBMClassifier class

#Combining the models using Voting Classifier
voting_model = VotingClassifier(estimators=[('rf', RandomForest_model), ('lgbm', LightGBM_model)], voting='soft') #This is used to create an instance of the VotingClassifier class with the Random Forest and LightGBM models as estimators

voting_model.fit(X_train, Y_train) #This is used to fit the voting model to the training data

print("Voting Model trained successfully!") #This is used to print a message indicating that the model has been trained successfully
print("Training Accuracy:", voting_model.score(X_train, Y_train)) #This is used to print the training accuracy of the model

Y_pred_proba = voting_model.predict_proba(X_test)[:, 1] #This is used to get the predicted probabilities for the positive class (1) from the voting model
Y_pred_proba = voting_model.predict_proba(X_test)[:, 1] #This is used to get the predicted probabilities for the positive class (1) from the voting model

precision = precision_score(Y_test, (Y_pred_proba >= 0.5).astype(int)) #This is used to calculate the precision of the model
recall = recall_score(Y_test, (Y_pred_proba >= 0.5).astype(int)) #This is used to calculate the recall of the model
f1 = f1_score(Y_test, (Y_pred_proba >= 0.5).astype(int)) #This is used to calculate the F1 score of the model
roc_auc = roc_auc_score(Y_test, Y_pred_proba) #This is used to calculate the ROC AUC score of the model

tn, fp, fn, tp = confusion_matrix(Y_test, (Y_pred_proba >= 0.5).astype(int)).ravel() #This is used to calculate the confusion matrix of the model and unpack the values into true negatives (tn), false positives (fp), false negatives (fn), and true positives (tp)
false_positive_rate = fp / (fp + tn) #This is used to calculate the false positive rate of the model

print("-------------------------------------------------")
print("Voting Classifier Evaluation metrics (Default):")
print("Precision:", precision) #This is used to print the precision of the model
print("Recall:", recall) #This is used to print the recall of the model
print("F1 Score:", f1) #This is used to print the F1 score of the model
print("ROC AUC Score:", roc_auc) #This is used to print the ROC AUC score of the model
print("True Negatives (TN):", tn) #This is used to print the number of true negatives of the model
print("False Positives (FP):", fp) #This is used to print the number of false positives of the model
print("False Negatives (FN):", fn) #This is used to print the number of false negatives of the model
print("True Positives (TP):", tp) #This is used to print the number of true positives of the model

