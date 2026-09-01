import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import demoData from "../data/demo_data.json";

export default function ManualScan() {
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    
    if (!domain.trim()) {
      setError("Please enter a valid domain.");
      return;
    }

    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain.trim())) {
      setError("Invalid format. Please enter a valid domain (e.g. google.com).");
      return;
    }

    setLoading(true);

    // Simulate backend loading delay
    setTimeout(() => {
      // Find matching domain in mock data
      const matchedRecord = demoData.find(
        (record) => record.domain.toLowerCase() === domain.trim().toLowerCase()
      );

      setLoading(false);

      if (matchedRecord) {
        navigate(`/review/${matchedRecord.id}`);
      } else {
        // Fallback to record ID 1 if not found in demo data
        navigate(`/review/1`);
      }
    }, 1500); // 1.5 seconds loading state
  };

  return (
    <>
      <Header 
        title="Manual Domain Scan" 
        subtitle="Paste any domain to request a risk score and explainability result." 
      />

      <section className="scan-box">
        <h2>Enter a domain</h2>
        <form className="scan-input-group" onSubmit={handleSubmit}>
          <label htmlFor="domain-input">Domain name or URL</label>
          <div className="scan-input-row">
            <input 
              id="domain-input"
              type="text" 
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Enter a domain, for example: google.com"
              disabled={loading}
            />
            <button
              type="submit"
              className="btn-scan"
              disabled={loading}
              style={{
                textDecoration: "none",
                display: "inline-block",
                textAlign: "center",
                color: "black",
                padding: "10px 24px",
                boxSizing: "border-box",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? "SCANNING..." : "SCAN DOMAIN"}
            </button>
          </div>
          {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
        </form>
      </section>

      {/* Show the loading state dynamically based on the 'loading' state */}
      {loading && (
        <section className="state-boxes">
          <div className="state-box">
            <strong>LOADING STATE</strong>
            <p>Scanning domain...</p>
            <p>Extracting lexical, WHOIS, SSL, DNS, and hosting features.</p>
          </div>
        </section>
      )}

      <section className="steps-box">
        <ol>
          <li>Validate the domain</li>
          <li>Request analysis from backend</li>
          <li>Extract detailed domain features</li>
          <li>Calculate the 0-100 risk score</li>
          <li>Open the Scan Result page</li>
        </ol>
      </section>
    </>
  );
}
