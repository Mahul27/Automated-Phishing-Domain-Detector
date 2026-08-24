# Automated Phishing Domain Detector

**Threat Hunters | IT7510 IT Capstone Project | Trimester 2, 2026**

The **Automated Phishing Domain Detector** is a cybersecurity capstone project designed to identify newly registered or unfamiliar domains that may be associated with phishing. The system combines public domain intelligence, machine learning, explainable AI, a REST API, and a web dashboard to help users review suspicious domains earlier.

> **Project status:** Development in progress.

---

## Project Overview

Phishing domains are often created and used very quickly. Newly registered domains may have little or no reputation history, which makes them difficult for traditional reputation-based security tools to identify early.

This project aims to provide an early-warning system that collects domain information from public sources, extracts useful features, evaluates the domain using machine-learning models, and returns an understandable risk score for human review.

The system is designed as a **decision-support tool**. It does not automatically block, remove, or officially label a domain as phishing without human review.

---

## Main Objectives

- Collect newly registered and known phishing domains from public sources.
- Extract useful lexical, registration, SSL, DNS, hosting, and NLP-based features.
- Use machine learning to classify suspicious and legitimate domains.
- Generate a **0-100 risk score** for each analysed domain.
- Explain model predictions using **SHAP**.
- Provide a web dashboard for searching, filtering, reviewing, and monitoring domain results.
- Provide REST API endpoints for communication between the frontend, backend, database, and machine-learning components.
- Keep a human analyst involved in the final review decision.

---

## Core Features

### Domain Analysis

- Manual domain search and analysis.
- Automated collection of newly registered domains from public feeds.
- CSV/JSON domain upload for batch analysis.
- Domain feature extraction.
- Phishing/legitimate prediction result.
- 0-100 phishing risk score.

### Explainable AI

- SHAP-based explanation for predictions.
- Shows which extracted features contributed most strongly to a domain's risk score.
- Helps users understand why a domain was considered suspicious or low risk.

### Dashboard

- React-based web interface.
- Search and filter domain results.
- View risk scores and prediction results.
- View SHAP explanations.
- View previous scan/detection history.
- Review flagged domains before making a final decision.
- Report/export functionality where supported by the final implementation.

### Authentication

- User authentication using Supabase.
- Secure session handling.
- Role-based access control where required.

### Backend API

- REST API built with FastAPI.
- Domain submission and validation.
- Feature-extraction requests.
- Machine-learning inference.
- Risk-score responses.
- Database communication.
- Error handling, logging, API documentation, and API testing.

---

## Data Sources

The project uses publicly available/open data sources only.

- **OpenSquat** - newly registered/domain-monitoring data.
- **OpenPhish Community Feed** - known phishing URLs/domains.
- **PhishTank** - verified phishing data.
- **WHOIS / RDAP** - domain registration information.
- **Certificate Transparency Logs** - SSL/TLS certificate information and newly observed domains.

No confidential user information is intended to be collected or stored as part of the phishing-domain dataset.

---

## Machine Learning

### Primary Model

- **XGBoost**

### Comparative Models

The project may compare XGBoost with:

- Random Forest
- LightGBM
- Logistic Regression

The best-performing approach will be selected based on testing and evaluation results.

### Evaluation Metrics

Model performance will be evaluated using:

- Accuracy
- Precision
- Recall
- F1-score
- ROC-AUC
- False-positive rate

The project proposal targets **at least 90% precision** and aims to keep the **false-positive rate below 2%** at the selected operating threshold.

---

## Feature Engineering

The project plans to use a selected set of approximately **10 domain-related features**. These may include information from:

- Domain length and lexical structure
- Numbers and special characters
- Subdomain patterns
- Suspicious or brand-related words
- Domain entropy/patterns
- Top-level domain information
- WHOIS/RDAP registration information
- Domain age
- SSL/TLS certificate information
- DNS, IP, and hosting-related information

The final feature set may be adjusted during model testing based on data availability and model performance.

---

## High-Level Architecture

```text
Public Domain Sources
        |
        v
Data Collection
(OpenSquat / OpenPhish / PhishTank / CT Logs / WHOIS-RDAP)
        |
        v
Data Cleaning + Feature Extraction
        |
        v
Machine Learning Model
(XGBoost + comparative models)
        |
        +----> SHAP Explainability
        |
        v
FastAPI REST Backend
        |
        +----> MySQL Database
        |
        +----> Supabase Authentication
        |
        v
React Web Dashboard
        |
        v
Human Review / Final Decision
```

---

## Technology Stack

| Area                    | Technology                                                                 |
| ----------------------- | -------------------------------------------------------------------------- |
| Frontend                | React.js                                                                   |
| Backend                 | Python, FastAPI                                                            |
| Database                | MySQL                                                                      |
| Authentication          | Supabase                                                                   |
| Primary ML Model        | XGBoost                                                                    |
| Comparative ML Models   | Random Forest, LightGBM, Logistic Regression                               |
| ML Libraries            | scikit-learn                                                               |
| Explainable AI          | SHAP                                                                       |
| NLP                     | spaCy or equivalent NLP library                                            |
| Data Sources            | OpenSquat, OpenPhish, PhishTank, WHOIS/RDAP, Certificate Transparency Logs |
| API Testing             | Postman                                                                    |
| Version Control         | Git, GitHub                                                                |
| Project Management      | Jira - Agile Kanban                                                        |
| Development Environment | Visual Studio Code                                                         |

---

## Project Scope

### In Scope

- Public phishing and legitimate-domain data collection.
- Newly registered domain monitoring.
- Domain feature extraction and preprocessing.
- Machine-learning model training and evaluation.
- Risk scoring.
- SHAP explainability.
- REST API development.
- React web dashboard.
- MySQL storage.
- Supabase authentication.
- Manual and batch domain analysis.
- Human-in-the-loop review.
- Unit, integration, API, system, and user-acceptance testing.
- Technical, deployment, and user documentation.

### Out of Scope

- Automatic blocking or takedown of malicious domains.
- Detection of phishing emails or malicious attachments.
- Malware detection.
- Mobile applications.
- Commercial threat-intelligence subscriptions.
- Integration with commercial SIEM/SOAR platforms.
- Collection or storage of confidential user information.
- Production deployment into a live enterprise environment.
- Continuous model retraining after the capstone project is completed.

---

## Team - Threat Hunters

| Team Member           | Primary Role                                                     |
| --------------------- | ---------------------------------------------------------------- |
| Mahul Patel           | Project Manager, Dataset Researcher & Machine Learning Developer |
| Kartar Singh Johal    | Backend & API Developer, Feature Engineering                                         |
| Bhupinder Singh       | Frontend Developer, UI/UX Designer & Software Tester             |
| Jaskaran Singh Sandhu | Database Support Developer & Software Tester                     |

### Shared Responsibilities

All team members contribute to:

- Research
- Documentation
- Git/GitHub collaboration
- System integration
- Testing and bug fixing
- Client/advisor feedback
- Final demonstration and presentation

---

## Development Methodology

The project uses an **Agile Kanban** approach.

Typical Jira workflow:

```text
To Do -> In Progress -> Review/Testing -> Done
```

Kanban was selected because the project includes experimental work such as dataset preparation, feature engineering, machine-learning evaluation, and system integration. Tasks can be reprioritised when technical findings or feedback require changes.

---

## Development Plan

The project is being developed incrementally so that individual components can be tested before full integration.

1. Requirements and project planning
2. Development environment setup
3. Data collection
4. Data cleaning and feature engineering
5. Machine-learning model development
6. Backend API development
7. Database and authentication development
8. Frontend dashboard development
9. System integration
10. Testing and bug fixing
11. Model/performance improvements
12. Documentation and final presentation

---

## Local Development

The project is currently under active development. Detailed installation commands will be updated once the initial frontend, backend, database, and machine-learning project structure is finalised in the repository.

Expected development requirements include:

- Git
- Python
- Node.js and npm
- MySQL Community Edition
- Supabase account/project for authentication
- Visual Studio Code or another IDE
- Postman for API testing

### Clone the Repository

```bash
git clone <repository-url>
cd <project-folder>
```

Additional frontend, backend, database, environment-variable, and model setup instructions will be added as development progresses.

---

## Testing Strategy

Testing will include:

- Unit testing
- Backend/API testing
- Integration testing
- Frontend functional testing
- Database/data-integrity testing
- Model performance testing
- Regression testing
- Usability testing
- User acceptance testing

Special attention will be given to **false positives**, **false negatives**, prediction quality, API integration, and the reliability of the final demonstration.

---

## Security and Privacy

- Only publicly available/open domain information is intended to be used for domain analysis.
- The application will not automatically block or take down domains.
- Final decisions remain with a human reviewer.
- Authentication is separated from the primary project database through Supabase.
- Secrets, API keys, database credentials, and environment variables must **never be committed to GitHub**.

Recommended files such as `.env` should be included in `.gitignore`.

---

## Academic Context

This repository is being developed for **IT7510 IT Capstone Project**, a Level 7, 45-credit capstone course at Whitireia and WelTec during Trimester 2, 2026.

The project demonstrates research, analysis, design, development, testing, project management, documentation, teamwork, and presentation skills in an industry-focused IT project.

---

## Current Status

**Development in progress.**

The project has moved from proposal/planning into development, including environment setup, data-source work, machine-learning preparation, backend development, frontend development, database work, authentication, and integration planning.

This README will be updated as the system architecture and implementation are completed.
