import Header from "../components/Header";
import { useParams, useNavigate } from "react-router-dom";
import demoData from "../data/demo_data.json";

export default function ScanResult() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Find the specific record from demo data, or fallback to the first one
  const record = demoData.find((r) => r.id === parseInt(id)) || demoData[0];

  return (
    <>
      <Header
        title="Review Details"
        subtitle="Detailed analysis of the requested domain."
      />

      <div style={{ marginBottom: "15px" }}>
        <button
          onClick={() => navigate("/history")}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold",
          }}
        >
          &larr; Back to History
        </button>
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
                color: record.risk_score > 50 ? "red" : "green",
                fontWeight: "bold",
              }}
            >
              {record.risk_score}/100
            </span>
          </li>
          <li style={{ marginBottom: "10px" }}>
            <strong>Prediction:</strong>{" "}
            <span
              style={{
                color: record.risk_score > 50 ? "red" : "green",
                fontWeight: "bold",
              }}
            >
              {record.prediction}
            </span>
          </li>
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
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "10px",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f0f0f0", textAlign: "left" }}>
              <th style={{ padding: "10px", border: "1px solid #ccc" }}>
                Feature
              </th>
              <th style={{ padding: "10px", border: "1px solid #ccc" }}>
                Detected Value
              </th>
              <th style={{ padding: "10px", border: "1px solid #ccc" }}>
                Risk Indicator
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                1. Domain Age
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.domain_age}
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
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
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                2. Registration Period
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.registration_period}
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
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
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                3. Domain Length
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.domain_length} characters
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
                  color: record.domain_length > 20 ? "orange" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.domain_length > 20 ? "Medium Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                4. Number of Hyphens
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.hyphens} hyphens
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
                  color: record.hyphens > 1 ? "red" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.hyphens > 1 ? "High Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                5. Number of Digits
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.digits} digits
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
                  color: record.digits > 0 ? "orange" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.digits > 0 ? "Medium Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                6. Shannon Entropy
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.shannon_entropy} entropy
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
                  color: record.shannon_entropy === "High" ? "red" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.shannon_entropy === "High" ? "High Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                7. Brand Keyword
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.brand_keyword}
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
                  color: record.brand_keyword !== "None" ? "red" : "green",
                  fontWeight: "bold",
                }}
              >
                {record.brand_keyword !== "None" ? "High Risk" : "Low Risk"}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                8. Typosquatting Similarity
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.typosquatting_similarity}
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
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
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                9. SSL Certificate Age
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.ssl_cert_age}
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
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
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                10. Top-Level Domain (TLD)
              </td>
              <td style={{ padding: "10px", border: "1px solid #ccc" }}>
                {record.tld}
              </td>
              <td
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
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
        <h2 style={{ color: "#d9534f", marginBottom: "10px", marginTop: 0 }}>
          Human decision required
        </h2>
        <p style={{ marginBottom: "5px" }}>
          This score are not confirmed yet please wait for the analyst to review
          it
        </p>
        <p style={{ marginBottom: "20px" }}>
          Review the evidence before recording a final decision.
        </p>

        <div style={{ display: "flex", gap: "15px" }}>
          <button
            onClick={() => {
              alert("Marked as false positive");
              navigate("/history");
            }}
            style={{
              padding: "10px 20px",
              cursor: "pointer",
              backgroundColor: "#f0ad4e",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
            }}
          >
            Mark false positive
          </button>
          <button
            onClick={() => {
              alert("Confirmed as phishing");
              navigate("/history");
            }}
            style={{
              padding: "10px 20px",
              cursor: "pointer",
              backgroundColor: "#d9534f",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold",
            }}
          >
            Confirm phishing
          </button>
        </div>
      </section>
    </>
  );
}
