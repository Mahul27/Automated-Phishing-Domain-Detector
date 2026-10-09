# Automated Phishing Domain Detector (APDD)

An automated cybersecurity system designed to identify newly registered and suspicious phishing domains. The project combines machine learning (XGBoost), explainable AI (SHAP), automated feature extraction, a FastAPI backend, a MySQL database, and a React dashboard for human analyst review.

---

## Implemented Features

### 1. Live Dashboard
- **Overview Metrics**: Displays total scans, phishing detections, legitimate domains, and pending reviews.
- **Charts**: Risk score distribution and detection breakdown powered by Recharts.

### 2. Analyst Workspace
- **Manual Domain Scan**: Scan any domain in real time.
- **Batch Import**: Upload CSV or JSON files (up to 2 MB) to scan multiple domains at once.
- **Personal Scan History**: Searchable and filterable table of past analyst scans.

### 3. Live Review Queue
- **Live Feed Feed**: Stream of newly identified domains from OpenSquat feeds.
- **Filtering & Search**: Filter by prediction (Phishing / Legitimate) and review status (Pending / Completed).

### 4. Detailed Scan Analysis & Human Review
- **Risk Scoring**: Generates a 0–100 risk score and classification (Phishing vs Legitimate).
- **Model Confidence**: Confidence percentage of the prediction.
- **10 Extracted Features**: Full breakdown of all calculated domain attributes.
- **Explainable AI (SHAP)**: Shows which features increased or decreased the phishing score.
- **Analyst Decision**: Human analysts can mark a scan as **Confirmed Phishing** or **False Positive** and save notes.

### 5. 10 Implemented Features Extracted per Domain
1. **Domain Age** (days) - Extracted via live RDAP query.
2. **Registration Period** (days) - Difference between domain expiration and creation dates (RDAP).
3. **Domain Length** - Character count of the registrable domain name.
4. **Hyphen Count** - Number of hyphens in the domain.
5. **Digit Count** - Number of digits in the domain.
6. **Shannon Entropy** - Mathematical randomness/complexity of the domain string.
7. **Brand Keyword Detection** - Checks for known brand names (`brands_keywords.txt`).
8. **Typosquatting Similarity** - Similarity score matching against target brand keywords.
9. **SSL Certificate Age** (days) - Validated via live TLS/SSL handshake.
10. **TLD** - Extracted using `tldextract`.

---

## Technologies Used

Only the technologies actually implemented in the project:

### Frontend
- **React 19** - User interface.
- **Vite** - Frontend build tool and development server.
- **React Router (v7)** - Client-side page navigation.
- **Recharts** - Charts for the dashboard.
- **Vanilla CSS** - Application styling.

### Backend & Machine Learning
- **Python 3.12** - Backend programming language.
- **FastAPI** - REST API framework.
- **Uvicorn** - ASGI server for FastAPI.
- **XGBoost** - Machine learning model for phishing detection (`backend/models/final_xgboost_model.json`).
- **SHAP** - Feature contributions and explainability for model predictions.
- **Scikit-learn** - Data preprocessing and transformers.
- **Pandas & NumPy** - Data processing and feature manipulation.
- **Pydantic** - Request and response data validation.

### Database & Storage
- **MySQL** - Relational database storing scans, features, and model outputs.
- **SQLAlchemy & PyMySQL** - Database ORM and MySQL driver.

### Authentication
- **Supabase Auth** - User authentication (Sign up, Login, Password Reset, session management).

### Domain Tools & Feeds
- **OpenSquat** - CLI integration for collecting newly registered suspicious domains.
- **tldextract** - Domain suffix and TLD parsing.
- **RDAP & SSL Sockets** - Domain registration and certificate data extraction.

---

## Database Structure (MySQL)

The database schema (`database/Automated_Phishing_Domain_Detector_Schema.sql`) includes 5 tables:

1. `app_users` - Stores user IDs linked to Supabase authentication.
2. `domains` - Unique domain names and creation timestamps.
3. `scan_results` - Scan timestamp, prediction (Phishing/Legitimate), risk score (0–100), and user link.
4. `domain_features` - Stores the 10 extracted domain features for each scan.
5. `model_outputs` - Stores model name, confidence score, and explanation for each scan.

---

## Project Structure

```text
Automated-Phishing-Domain-Detector/
├── backend/
│   ├── data/                 # Brand keyword lists and feature cache
│   ├── models/               # Trained XGBoost model (final_xgboost_model.json)
│   ├── scripts/              # Script to refresh live OpenSquat domains
│   ├── services/             # Feature engineering, ML prediction, OpenSquat, DB logic
│   ├── tests/                # Backend unit tests
│   ├── config.py             # Configuration and environment loader
│   ├── database.py           # MySQL SQLAlchemy connection
│   └── main.py               # FastAPI application endpoints
├── database/
│   └── Automated_Phishing_Domain_Detector_Schema.sql  # MySQL schema
├── src/
│   ├── components/           # Reusable UI components (Sidebar, Layout, ProtectedRoute, etc.)
│   ├── pages/                # Pages (Dashboard, Workspace, Queue, ScanResult, Login, Signup)
│   ├── Services/             # API client connecting frontend to FastAPI
│   ├── utils/                # Supabase client helper
│   ├── App.jsx               # Routes and app structure
│   └── main.jsx              # React root entry
├── package.json              # Frontend dependencies and npm scripts
├── requirements.txt          # Python dependencies
└── README.md
```

---

## Setup & Running the Project

### Prerequisites
- Python 3.12+
- Node.js (v18+) and npm
- MySQL Server

---

### 1. Database Setup
Run the SQL schema in MySQL:
```bash
mysql -u <username> -p < database/Automated_Phishing_Domain_Detector_Schema.sql
```

---

### 2. Backend Setup
1. Open the project directory:
   ```bash
   cd Automated-Phishing-Domain-Detector
   ```
2. Create and activate a virtual environment:
   ```bash
   python3.12 -m venv .venv
   source .venv/bin/activate   # On Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure backend environment in `backend/.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_NAME=automated_phishing_detector
   ```
5. Start the backend:
   ```bash
   npm run backend
   # or: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
   API will run at: `http://127.0.0.1:8000` (docs at `http://127.0.0.1:8000/docs`).

---

### 3. Frontend Setup
1. In the project root, configure `.env.local`:
   ```env
   VITE_API_BASE_URL=http://127.0.0.1:8000
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Frontend will run at: `http://localhost:5173`.

---

### 4. Fetching Live Domains (OpenSquat)
To pull and scan newly registered domains into the live review queue:
```bash
npm run domains:refresh
# or: .venv/bin/python -m backend.scripts.refresh_live
```

---

## Project Team (Threat Hunters)

- **Mahul Patel** - Project Manager & Machine Learning Developer
- **Kartar Singh Johal** - Backend & API Developer
- **Bhupinder Singh** - Frontend Developer & UI/UX Designer
- **Jaskaran Singh Sandhu** - Database Support Developer
