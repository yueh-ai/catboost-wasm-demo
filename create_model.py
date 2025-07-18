#!/usr/bin/env python3
"""
Create a simple CatBoost model with categorical features for testing WebAssembly integration.
"""
import catboost as cb
import pandas as pd
import numpy as np

# Create a simple dataset with categorical features
np.random.seed(42)
n_samples = 1000

# Numerical features
age = np.random.randint(18, 70, n_samples)
income = np.random.randint(20000, 150000, n_samples)
hours_per_week = np.random.randint(20, 60, n_samples)

# Categorical features
education = np.random.choice(['HS-grad', 'Bachelors', 'Masters', 'Doctorate'], n_samples)
occupation = np.random.choice(['Tech', 'Sales', 'Service', 'Admin'], n_samples)
marital_status = np.random.choice(['Single', 'Married', 'Divorced'], n_samples)

# Create target variable (binary classification)
# Higher education + Tech + more hours = higher chance of high income
target = ((education == 'Masters') | (education == 'Doctorate')).astype(int) * 0.3 + \
         (occupation == 'Tech').astype(int) * 0.3 + \
         (hours_per_week > 40).astype(int) * 0.2 + \
         (income > 75000).astype(int) * 0.2

target = (target + np.random.normal(0, 0.2, n_samples) > 0.5).astype(int)

# Create DataFrame
df = pd.DataFrame({
    'age': age,
    'income': income,
    'hours_per_week': hours_per_week,
    'education': education,
    'occupation': occupation,
    'marital_status': marital_status,
    'target': target
})

# Split features and target
X = df.drop('target', axis=1)
y = df['target']

# Specify categorical features
cat_features = ['education', 'occupation', 'marital_status']

# Create and train model
model = cb.CatBoostClassifier(
    iterations=100,
    depth=4,
    learning_rate=0.1,
    cat_features=cat_features,
    verbose=False
)

model.fit(X, y)

# Save model
model.save_model('catboost-wasm-demo/models/demo_model.cbm')

# Save model in JSON format for inspection
model.save_model('catboost-wasm-demo/models/demo_model.json', format='json')

print("Model created successfully!")
print(f"Float features: {[f for f in X.columns if f not in cat_features]}")
print(f"Categorical features: {cat_features}")
print(f"Model size: {model.tree_count_} trees")

# Create a sample prediction to verify
sample = pd.DataFrame({
    'age': [35],
    'income': [80000],
    'hours_per_week': [45],
    'education': ['Masters'],
    'occupation': ['Tech'],
    'marital_status': ['Married']
})

prediction = model.predict_proba(sample)[0]
print(f"\nSample prediction: {prediction}")