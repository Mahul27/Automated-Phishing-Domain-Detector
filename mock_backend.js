import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let liveRecords = [
  {
    id: 1,
    domain: "google-login-update.com",
    tld: ".com",
    risk_score: 95,
    prediction: "Phishing",
    review_status: "Pending",
    decision: null,
    scan_time: new Date().toISOString(),
  },
  {
    id: 2,
    domain: "paypal-secure-auth.net",
    tld: ".net",
    risk_score: 88,
    prediction: "Phishing",
    review_status: "Pending",
    decision: null,
    scan_time: new Date().toISOString(),
  },
  {
    id: 3,
    domain: "amazon.com",
    tld: ".com",
    risk_score: 12,
    prediction: "Legitimate",
    review_status: "Completed",
    decision: "False Positive",
    reviewer: "Analyst",
    review_date: new Date().toISOString(),
    scan_time: new Date().toISOString(),
  },
];

let personalRecords = [
  {
    id: 101,
    domain: "suspicious-link.xyz",
    original: "http://suspicious-link.xyz/login",
    source: "import",
    risk_score: 78,
    prediction: "Phishing",
    review_status: "Pending",
    decision: null,
    scan_time: new Date().toISOString(),
  },
  {
    id: 102,
    domain: "mybank.com",
    source: "manual",
    risk_score: 15,
    prediction: "Legitimate",
    review_status: "Pending",
    decision: null,
    scan_time: new Date().toISOString(),
  },
];

let nextId = 1000;

app.get("/api/v1/health", (req, res) => res.json({ status: "ok" }));

app.get("/api/v1/dashboard/summary", (req, res) => {
  res.json({
    domains_monitored: 1240,
    high_risk_alerts: 42,
    pending_review: 18,
    reviewed: 24,
    risk_distribution: { Low: 800, Medium: 300, High: 140 },
    weekly_trend: [
      { name: "Mon", detected: 12, critical: 4 },
      { name: "Tue", detected: 19, critical: 8 },
      { name: "Wed", detected: 15, critical: 5 },
      { name: "Thu", detected: 22, critical: 10 },
      { name: "Fri", detected: 10, critical: 2 },
      { name: "Sat", detected: 5, critical: 1 },
      { name: "Sun", detected: 3, critical: 0 },
    ],
  });
});

app.post("/api/v1/scans", (req, res) => {
  const { domain } = req.body || {};
  if (!domain || typeof domain !== "string") {
    return res
      .status(400)
      .json({ detail: "Domain is required and must be a string." });
  }
  const cleanDomain = domain.trim();
  const newScan = {
    id: nextId++,
    domain: cleanDomain,
    source: "manual",
    risk_score: Math.floor(Math.random() * 100),
    prediction: Math.random() > 0.5 ? "Phishing" : "Legitimate",
    review_status: "Pending",
    decision: null,
    scan_time: new Date().toISOString(),
    domain_age: "10 days",
    registration_period: "1 year",
    domain_length: cleanDomain.length,
    hyphens: (cleanDomain.match(/-/g) || []).length,
    digits: (cleanDomain.match(/\d/g) || []).length,
    shannon_entropy: "High",
    brand_keyword: "None",
    typosquatting_similarity: "Low",
    ssl_cert_age: "5 days",
    tld: `.${cleanDomain.split(".").pop()}`,
  };
  personalRecords.unshift(newScan);
  res.json(newScan);
});

app.get("/api/v1/scans", (req, res) => {
  const { collection } = req.query;
  if (collection === "personal") {
    res.json({ records: personalRecords });
  } else {
    res.json({ records: liveRecords });
  }
});

app.get("/api/v1/scans/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const record =
    personalRecords.find((r) => r.id === id) ||
    liveRecords.find((r) => r.id === id);
  if (record) {
    // Add fake extra details if they don't exist
    const fullRecord = {
      ...record,
      domain_age: record.domain_age || "30 days",
      registration_period: record.registration_period || "1 year",
      domain_length: record.domain_length || record.domain.length,
      hyphens: record.hyphens || 0,
      digits: record.digits || 0,
      shannon_entropy: record.shannon_entropy || "Low",
      brand_keyword: record.brand_keyword || "None",
      typosquatting_similarity: record.typosquatting_similarity || "Low",
      ssl_cert_age: record.ssl_cert_age || "20 days",
      tld: record.tld || `.${record.domain.split(".").pop()}`,
    };
    res.json(fullRecord);
  } else {
    res.status(404).json({ detail: "Record not found" });
  }
});

app.patch("/api/v1/scans/:id/review", (req, res) => {
  const id = parseInt(req.params.id);
  const { decision, note } = req.body;

  let record =
    personalRecords.find((r) => r.id === id) ||
    liveRecords.find((r) => r.id === id);
  if (record) {
    record.review_status = "Completed";
    record.decision = decision;
    record.note = note;
    record.reviewer = "Demo Analyst";
    record.review_date = new Date().toISOString();
    res.json(record);
  } else {
    res.status(404).json({ detail: "Record not found" });
  }
});

app.post("/api/v1/imports", (req, res) => {
  const importedDomains = [
    "secure-portal-update.xyz",
    "apple-id-verify-alert.com",
    "corporate-login-gateway.net",
    "cloud-storage-auth.co",
    "official-payment-notice.org",
  ];

  importedDomains.forEach((domain) => {
    personalRecords.unshift({
      id: nextId++,
      domain,
      original: `https://${domain}`,
      source: "import",
      risk_score: Math.floor(Math.random() * 100),
      prediction: Math.random() > 0.4 ? "Phishing" : "Legitimate",
      review_status: "Pending",
      decision: null,
      scan_time: new Date().toISOString(),
    });
  });

  setTimeout(() => {
    res.json({
      filename: "uploaded_domains.csv",
      accepted_count: importedDomains.length,
      rejected_count: 1,
      errors: [{ row: 6, message: "Invalid domain format: missing TLD" }],
    });
  }, 500);
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Mock backend running on http://127.0.0.1:${PORT}`);
});
