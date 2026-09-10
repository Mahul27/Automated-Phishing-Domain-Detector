import Header from "../components/Header";
import { useParams, useNavigate } from "react-router-dom";
import { useScanData } from "../context/ScanDataContext";
import { getRiskColor } from "../utils/risk";
import Button from "../components/Button";

export default function ScanResult() {
  const { source, id } = useParams();
  const navigate = useNavigate();
  const { personalRecords, liveRecords, updatePersonalRecord, updateLiveRecord } = useScanData();

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
          <Button variant="secondary" onClick={() => navigate(isPersonalRecord ? "/workspace" : "/queue")}>&larr; Return to Scan History</Button>
        </div>
      </>
    );
  }

  const handleDecision = (isPhishing) => {
    const updatedRecord = { ...record };
    updatedRecord.review_status = "Completed";
    updatedRecord.decision = isPhishing ? "Confirmed Phishing" : "False Positive";
    updatedRecord.reviewer = "Current Analyst";
    updatedRecord.review_date = new Date().toISOString().split("T")[0];

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
        <Button variant="secondary" onClick={() => navigate(isPersonalRecord ? "/workspace" : "/queue")}>&larr; Back to History</Button>
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
                <strong>Review Status:</strong> <span>{record.review_status}</span>
              </li>
              <li style={{ marginBottom: "10px" }}>
                <strong>Analyst Decision:</strong> <span>{record.decision}</span>
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
              <th >
                Feature
              </th>
              <th >
                Detected Value
              </th>
              <th >
                Risk Indicator
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td >
                1. Domain Age
              </td>
              <td >
                {record.domain_age}
              </td>
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
              <td >
                2. Registration Period
              </td>
              <td >
                {record.registration_period}
              </td>
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
              <td >
                3. Domain Length
              </td>
              <td >
                {record.domain_length} characters
              </td>
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
              <td >
                4. Number of Hyphens
              </td>
              <td >
                {record.hyphens} hyphens
              </td>
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
              <td >
                5. Number of Digits
              </td>
              <td >
                {record.digits} digits
              </td>
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
              <td >
                6. Shannon Entropy
              </td>
              <td >
                {record.shannon_entropy} entropy
              </td>
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
              <td >
                7. Brand Keyword
              </td>
              <td >
                {record.brand_keyword}
              </td>
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
              <td >
                8. Typosquatting Similarity
              </td>
              <td >
                {record.typosquatting_similarity}
              </td>
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
              <td >
                9. SSL Certificate Age
              </td>
              <td >
                {record.ssl_cert_age}
              </td>
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
              <td >
                10. Top-Level Domain (TLD)
              </td>
              <td >
                {record.tld}
              </td>
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
            <p>
              This scan was reviewed by <strong>{record.reviewer}</strong> on{" "}
              <strong>{record.review_date}</strong>. The final decision was{" "}
              <strong>{record.decision}</strong>.
            </p>
          </div>
        ) : (
          <>
            <h2 style={{ color: "#d9534f", marginBottom: "10px", marginTop: 0 }}>
              Human decision required
            </h2>
            <p style={{ marginBottom: "5px" }}>
              This score is not confirmed yet. Please wait for the analyst to review it.
            </p>
            <p style={{ marginBottom: "20px" }}>
              Review the evidence before recording a final decision.
            </p>

            <div style={{ display: "flex", gap: "15px" }}>
              <Button variant="warning" onClick={() => handleDecision(false)}>Mark false positive</Button>
              <Button variant="danger" onClick={() => handleDecision(true)}>Confirm phishing</Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
