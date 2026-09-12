import { useState } from "react";
import Header from "../components/Header";
import { useParams, useNavigate } from "react-router-dom";
import { useScanData } from "../context/ScanDataContext";
import { getRiskColor } from "../utils/risk";
import Button from "../components/Button";

export default function ScanResult() {
  const { source, id } = useParams();
  const navigate = useNavigate();
  const {
    personalRecords,
    liveRecords,
    updatePersonalRecord,
    updateLiveRecord,
  } = useScanData();

  const [reviewStatus, setReviewStatus] = useState("pending");
  const [analystNote, setAnalystNote] = useState("");

  // Find the specific record from either live or personal data
  const searchId = parseInt(id);
  const isPersonalRecord = source === "personal";
  const record = isPersonalRecord
    ? personalRecords.find((r) => r.id === searchId)
    : liveRecords.find((r) => r.id === searchId);

  if (!record) {
    return (
      <>
        <Header
          title="Review Details"
          subtitle="Detailed analysis of the requested domain."
        />
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h2>Scan result not found.</h2>
          <Button
            variant="secondary"
            onClick={() => navigate(isPersonalRecord ? "/workspace" : "/queue")}
          >
            &larr; Return to Scan History
          </Button>
        </div>
      </>
    );
  }

  const handleSaveDecision = () => {
    if (reviewStatus === "pending") {
      navigate(isPersonalRecord ? "/workspace" : "/queue");
      return;
    }

    const updatedRecord = { ...record };
    updatedRecord.review_status = "Completed";
    updatedRecord.decision =
      reviewStatus === "phishing" ? "Confirmed Phishing" : "False Positive";
    updatedRecord.reviewer = "Current Analyst";
    updatedRecord.review_date = new Date().toISOString().split("T")[0];
    updatedRecord.note = analystNote;

    if (isPersonalRecord) {
      updatePersonalRecord(updatedRecord);
    } else {
      updateLiveRecord(updatedRecord);
    }
    navigate(isPersonalRecord ? "/workspace" : "/queue");
  };

  return (
    <>
      <Header
        title="Review Details"
        subtitle="Detailed analysis of the requested domain."
      />

      <div style={{ marginBottom: "15px" }}>
        <Button
          variant="secondary"
          onClick={() => navigate(isPersonalRecord ? "/workspace" : "/queue")}
        >
          &larr; Back to History
        </Button>
      </div>

      {/* 1. Summary Information */}
      <section
        style={{
          border: "1px solid black",
          padding: "20px",
          marginBottom: "20px",
          backgroundColor: "#fff",
        }}
      >
        <h2>Summary</h2>
        <ul style={{ listStyle: "none", padding: 0, fontSize: "1.1em" }}>
          <li style={{ marginBottom: "10px" }}>
            <strong>Domain:</strong> <span>{record.domain}</span>
          </li>
          <li style={{ marginBottom: "10px" }}>
            <strong>Risk Score:</strong>{" "}
            <span
              style={{
                color: getRiskColor(record.risk_score),
                fontWeight: "bold",
              }}
            >
              {record.risk_score}/100
            </span>
          </li>
          <li style={{ marginBottom: "10px" }}>
            <strong>Model Prediction:</strong>{" "}
            <span
              style={{
                color: getRiskColor(record.risk_score),
                fontWeight: "bold",
              }}
            >
              {record.prediction}
            </span>
          </li>
          {record.review_status === "Completed" && (
            <>
              <li style={{ marginBottom: "10px" }}>
                <strong>Review Status:</strong>{" "}
                <span>{record.review_status}</span>
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Analyst Decision:</strong>{" "}
                <span>{record.decision}</span>
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Reviewer:</strong> <span>{record.reviewer}</span>
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Review Date:</strong> <span>{record.review_date}</span>
              </li>
            </>
          )}
        </ul>
      </section>

      {/* 2. Feature / Risk Information */}
      <section
        style={{
          border: "1px solid black",
          padding: "20px",
          marginBottom: "20px",
          backgroundColor: "#fff",
        }}
      >
        <h2>Feature & Risk Information</h2>
        <p>Values extracted by the backend ML model:</p>
        <table className="app-table" style={{ marginTop: "10px" }}>
          <thead>
            <tr style={{ backgroundColor: "#f0f0f0", textAlign: "left" }}>
              <th>Feature</th>
              <th>Detected Value</th>
              <th>Risk Indicator</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1. Domain Age</td>
              <td>{record.domain_age}</td>
              <td
                style={{
                  color:
                    record.domain_age.includes("day") ||
                    record.domain_age.includes("week")
                      ? "red"
                      : "green",
                  fontWeight: "bold",
                }}
              >
                {record.domain_age.includes("day") ||
                record.domain_age.includes("week")
                  ? "High Risk"
                  : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td>2. Registration Period</td>
              <td>{record.registration_period}</td>
              <td
                style={{
                  color:
                    record.registration_period === "1 year" ? "red" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.registration_period === "1 year"
                  ? "High Risk"
                  : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td>3. Domain Length</td>
              <td>{record.domain_length} characters</td>
              <td
                style={{
                  color: record.domain_length > 20 ? "orange" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.domain_length > 20 ? "Medium Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td>4. Number of Hyphens</td>
              <td>{record.hyphens} hyphens</td>
              <td
                style={{
                  color: record.hyphens > 1 ? "red" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.hyphens > 1 ? "High Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td>5. Number of Digits</td>
              <td>{record.digits} digits</td>
              <td
                style={{
                  color: record.digits > 0 ? "orange" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.digits > 0 ? "Medium Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td>6. Shannon Entropy</td>
              <td>{record.shannon_entropy} entropy</td>
              <td
                style={{
                  color: record.shannon_entropy === "High" ? "red" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.shannon_entropy === "High" ? "High Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td>7. Brand Keyword</td>
              <td>{record.brand_keyword}</td>
              <td
                style={{
                  color: record.brand_keyword !== "None" ? "red" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.brand_keyword !== "None" ? "High Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td>8. Typosquatting Similarity</td>
              <td>{record.typosquatting_similarity}</td>
              <td
                style={{
                  color:
                    record.typosquatting_similarity !== "Exact Match" &&
                    record.typosquatting_similarity !== "Low"
                      ? "red"
                      : "green",
                  fontWeight: "bold",
                }}
              >
                {record.typosquatting_similarity !== "Exact Match" &&
                record.typosquatting_similarity !== "Low"
                  ? "High Risk"
                  : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td>9. SSL Certificate Age</td>
              <td>{record.ssl_cert_age}</td>
              <td
                style={{
                  color:
                    record.ssl_cert_age.includes("day") ||
                    record.ssl_cert_age.includes("month")
                      ? "red"
                      : "green",
                  fontWeight: "bold",
                }}
              >
                {record.ssl_cert_age.includes("day") ||
                record.ssl_cert_age.includes("month")
                  ? "High Risk"
                  : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td>10. Top-Level Domain (TLD)</td>
              <td>{record.tld}</td>
              <td
                style={{
                  color:
                    record.tld === ".xyz" || record.tld === ".info"
                      ? "orange"
                      : "green",
                  fontWeight: "bold",
                }}
              >
                {record.tld === ".xyz" || record.tld === ".info"
                  ? "Medium Risk"
                  : "Low Risk"}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 3. Human Decision */}
      <section
        style={{
          border: "1px solid black",
          padding: "20px",
          marginBottom: "20px",
          backgroundColor: "#fff",
        }}
      >
        {record.review_status === "Completed" ? (
          <div>
            <h2 style={{ color: "green", marginBottom: "10px", marginTop: 0 }}>
              Decision Recorded
            </h2>
            <p style={{ marginBottom: "12px" }}>
              This scan was reviewed by <strong>{record.reviewer}</strong> on{" "}
              <strong>{record.review_date}</strong>. The final decision was{" "}
              <strong>{record.decision}</strong>.
            </p>
            {record.note && (
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "6px",
                  borderLeft: "4px solid #cbd5e1",
                }}
              >
                <h4
                  style={{
                    marginTop: 0,
                    marginBottom: "8px",
                    fontSize: "14px",
                    color: "#475569",
                  }}
                >
                  Analyst Note
                </h4>
                <p
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    color: "#334155",
                    lineHeight: "1.5",
                  }}
                >
                  {record.note}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 style={{ marginBottom: "10px", marginTop: 0 }}>Human review</h2>
            <h3 style={{ marginBottom: "5px", fontSize: "16px" }}>
              Record your decision
            </h3>
            <p style={{ marginBottom: "20px", color: "#64748b" }}>
              Your decision is kept separately from the calculated risk score.
            </p>

            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ marginBottom: "12px", fontSize: "14px" }}>
                Review status
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="reviewStatus"
                    value="pending"
                    checked={reviewStatus === "pending"}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    style={{ marginTop: "4px" }}
                  />
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                      Keep pending
                    </div>
                    <div style={{ color: "#64748b", fontSize: "13px" }}>
                      Leave this record open
                    </div>
                  </div>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="reviewStatus"
                    value="phishing"
                    checked={reviewStatus === "phishing"}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    style={{ marginTop: "4px" }}
                  />
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                      Phishing
                    </div>
                    <div style={{ color: "#64748b", fontSize: "13px" }}>
                      Record an analyst finding
                    </div>
                  </div>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="reviewStatus"
                    value="not_phishing"
                    checked={reviewStatus === "not_phishing"}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    style={{ marginTop: "4px" }}
                  />
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                      Not phishing
                    </div>
                    <div style={{ color: "#64748b", fontSize: "13px" }}>
                      Dismiss the suspected threat
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ marginBottom: "8px", fontSize: "14px" }}>
                Analyst note (optional)
              </h4>
              <p
                style={{
                  fontSize: "13px",
                  color: "#64748b",
                  margin: "0 0 8px 0",
                }}
              >
                What led you to this decision?
              </p>
              <textarea
                value={analystNote}
                onChange={(e) => setAnalystNote(e.target.value.slice(0, 2000))}
                style={{
                  width: "100%",
                  minHeight: "100px",
                  padding: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
              <div
                style={{
                  textAlign: "right",
                  fontSize: "12px",
                  color: "#64748b",
                  marginTop: "4px",
                }}
              >
                {analystNote.length} / 2,000 characters
              </div>
            </div>

            <Button variant="primary" onClick={handleSaveDecision}>
              Save decision
            </Button>
          </>
        )}
      </section>
    </>
  );
}
