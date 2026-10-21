# Automated Phishing Domain Detector (APDD)

An automated cybersecurity system designed to identify newly registered and suspicious phishing domains. The project combines machine learning (XGBoost), explainable AI (SHAP), automated feature extraction, a FastAPI backend, a MySQL database, and a React dashboard for human analyst review.

---

## Implemented Features

### 1. Live Dashboard
- **Overview Metrics**: Displays live domains monitored, high-risk alerts, pending reviews, and completed reviews.
- **Charts**: Risk score distribution and detection breakdown powered by Recharts.
- **OpenSquat Feed Controls**: Manually fetch and scan up to 10, 25, or 50 new domains per request (default 10), view the last successful fetch time and feed errors, and open saved domains for review. Results stay unchanged during review until another fetch is requested.

### 2. Analyst Workspace
- **Manual Domain Scan**: Scan any domain in real time.
- **Batch Import**: Upload CSV or JSON files (up to 2 MB) to scan multiple domains at once.
- **Personal Scan History**: Searchable and filterable table of past analyst scans.

### 3. Live Review Queue
- **Live Domains**: Saved domains from manually requested OpenSquat batches.
- **Filtering & Search**: Filter by prediction (Phishing / Legitimate) and review status (Pending / Completed).
- **CSV Export**: Export all loaded live domains, including review status and decisions, across all pages and filters.

### 4. Detailed Scan Analysis & Human Review
- **Risk Scoring**: Generates a 0–100 risk score and classification (Phishing vs Legitimate).
- **Model Confidence**: Confidence percentage of the prediction.
- **10 Extracted Features**: Full breakdown of all calculated domain attributes.
- **Explainable AI (SHAP)**: The scan result page displays the backend's saved contributions for all 10 features, with signed SHAP values and their effect on the phishing estimate. Values are in log-odds, not percentages or individual risk ratings. The backend's plain-language summary appears as numbered points. Older scans keep their saved text explanation; missing numerical contributions show as **Not available**, never as zero.
- **Analyst Decision**: Analysts choose **Phishing** or **Not phishing**, saved as **Confirmed Phishing** or **Confirmed Legitimate**, and can add notes. A separate **Model Outcome** compares the saved prediction with that verdict: True Positive, False Positive, True Negative, or False Negative. Risk scores and predictions stay unchanged. Older reviews saved as "False Positive" are read as legitimate verdicts, with the outcome calculated from the original prediction.

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
- **[OpenSquat](https://pypi.org/project/opensquat/)** - CLI integration for collecting newly registered suspicious domains, installed with the backend requirements.
- **tldextract** - Domain suffix and TLD parsing.
- **RDAP & SSL Sockets** - Domain registration and certificate data extraction.

---

## Database Structure (MySQL)

The database schema (`database/Automated_Phishing_Domain_Detector_Schema.sql`) includes 6 tables:

1. `app_users` - Stores user IDs linked to Supabase authentication.
2. `domains` - Unique domain names and creation timestamps.
3. `scan_results` - Scan timestamp, prediction (Phishing/Legitimate), risk score (0–100), and user link.
4. `domain_features` - Stores the 10 extracted domain features for each scan.
5. `model_outputs` - Stores model name, confidence score, and explanation for each scan.
6. `scan_shap_values` - Stores the actual grouped SHAP contributions as JSON for each scan.

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
- Node.js 22.12+ (or 20.19.x) and npm, as required by Vite 8
- MySQL Server

---

### 1. Database Setup
Run the SQL schema in MySQL:
```bash
mysql -u <username> -p < database/Automated_Phishing_Domain_Detector_Schema.sql
```

For an existing database, apply the `CREATE TABLE IF NOT EXISTS scan_shap_values`
statement in the **WEEK 15 DATABASE DEVELOPMENT** section of that file before
using Kartar's updated backend. Its scan endpoints now read this table. Older
scans without a SHAP row will still display their saved features and explanation;
new XGBoost scans save numerical contributions when SHAP calculation succeeds.

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
In the frontend, open **Live dashboard**, choose **10**, **25**, or **50** under
**New domains per fetch**, and select **Fetch new domains**. The default is **10**.
These are the only frontend dropdown options; the backend API and CLI still
support up to 2,000. Fetching and scanning can take several minutes.
The page shows the number added and readable feed or scanning messages.
An existing domain row is reused atomically so simultaneous scans cannot fail
by inserting the same domain name. If some scans fail, the successful additions
are kept and the page reports how many scans failed. SQL statements, database
parameters, and exception details stay in backend logs; they are not displayed
in the fetch controls. The refresh response includes `failed_count` and a stable
`error_code` for these messages.
The selected size is a maximum: fewer domains may be added if the feed has fewer
new candidates or some scans fail. The last successful source-fetch time is saved
in `backend/data/opensquat_state.json` and displayed in the browser's local time;
failed refreshes preserve the previous successful time. Earlier fetches made
before timestamp recording was added show **Not recorded yet**.

Saved results load once when the dashboard or review queue opens. The dashboard
updates after **Fetch new domains** finishes; reopen the review queue to see the
latest saved batch. The review queue contains only review and export controls.
There are no timed, focus, or visibility
updates, so analysts can review a stable set of results. Starting the backend
does not start a daily feed job.

Frontend code for fetching, timestamps, and readable result messages lives in
`src/pages/LiveDashboard.jsx`. Saved-record loading, filters, and CSV export live
in `src/pages/LiveReviewQueue.jsx`. Both pages use the existing API client in
`src/Services/Client.js` and styles in `src/index.css`.

Select **Export all CSV** next to **Clear filters** in the live review queue to download the current saved
snapshot, including every page and any domains hidden by queue filters. Exporting
does not fetch new domains or reload results. Personal workspace scans are kept
in their own collection.

To pull and scan newly registered domains into the live review queue:
```bash
npm run domains:refresh
# or: .venv/bin/python -m backend.scripts.refresh_live
# For a smaller batch:
.venv/bin/python -m backend.scripts.refresh_live --limit 10
```

To check the feed without scanning or saving domains:
```bash
npm run domains:check
```

---

## Project Team (Threat Hunters)

- **Mahul Patel** - Project Manager & Machine Learning Developer
- **Kartar Singh Johal** - Backend & API Developer
- **Bhupinder Singh** - Frontend Developer & UI/UX Designer
- **Jaskaran Singh Sandhu** - Database Support Developer
