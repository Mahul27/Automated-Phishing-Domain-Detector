import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix, roc_auc_score, roc_curve
from sklearn.model_selection import RandomizedSearchCV #This is used to import the RandomizedSearchCV class from the sklearn.model_selection module, which is used for hyperparameter tuning of the Random Forest model

# Load the training and test data
X_train = pd.read_csv('X_train.csv') #This is used to load the training data from the X_train.csv file into a pandas DataFrame  
X_test = pd.read_csv('X_test.csv') #This is used to load the test data from the X_test.csv file into a pandas DataFrame
Y_train = pd.read_csv('Y_train.csv')['label'] #This is used to load the target variable from the Y_train.csv file into a pandas Series
Y_test = pd.read_csv('Y_test.csv')['label'] #This is used to load the target variable from the Y_test.csv file into a pandas Series

parameter_grid = { #This is used to define a dictionary of hyperparameters and their corresponding values for the Random Forest model\
    'n_estimators': [100, 200, 300, 400, 500], #This is used to define the number of trees in the forest
    'max_depth': [None, 10, 20, 30, 40, 50], #This is used to define the maximum depth of the tree
    'min_samples_split': [2, 5, 10], #This is used to define the minimum number of samples required to split an internal node
    'min_samples_leaf': [1, 2, 4], #This is used to define the minimum number of samples required to be at a leaf node
}

base_model = RandomForestClassifier(random_state=42) #This is used to create an instance of the RandomForestClassifier class

random_search = RandomizedSearchCV(estimator=base_model, param_distributions=parameter_grid, n_iter=10, cv=5, scoring='roc_auc', random_state=42) #This is used to create an instance of the RandomizedSearchCV class with the base model and the parameter grid

random_search.fit(X_train, Y_train) #This is used to fit the random search model to the training data

print("Best hyperparameters found: ", random_search.best_params_) #This is used to print the best hyperparameters found by the random search model
print("Best recall score found: ", random_search.best_score_) #This is used to print the best recall score found by the random search model

best_model = random_search.best_estimator_ #This is used to get the best model found by the random search model

print("Best model trained successfully!") #This is used to print a message indicating that the best model has been trained successfully




        
