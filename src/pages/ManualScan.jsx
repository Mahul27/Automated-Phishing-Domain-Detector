import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import demoData from "../data/demo_data.json";

export default function ManualScan() {
  const location = useLocation();
  const [domain, setDomain] = useState(location.state?.domain || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    
    let input = domain;

    if (!input) {
      setError("Please enter a domain name.");
      return;
    }

    if (/\s/.test(input)) {
      setError("The domain cannot contain spaces.");
      return;
    }

    // Extract domain from full URL if necessary
    input = input.replace(/^https?:\/\//i, '');
    input = input.split('/')[0].split('?')[0];

    // Check for invalid characters
    if (/[^a-zA-Z0-9.-]/.test(input)) {
      setError("Invalid characters. A domain normally contains letters, numbers, dots, and hyphens.");
      return;
    }

    // Check for missing domain extension
    if (!/\.[a-zA-Z]{2,}$/.test(input)) {
      setError("Please enter a complete domain such as google.com.");
      return;
    }

    // Update input box to show the cleaned domain
    setDomain(input);
    setLoading(true);

    // Simulate backend loading delay
    setTimeout(() => {
      // Find matching domain in mock data
      const matchedRecord = demoData.find(
        (record) => record.domain.toLowerCase() === input.toLowerCase()
      );

      setLoading(false);

      if (matchedRecord) {
        navigate(`/review/${matchedRecord.id}`);
      } else {
        setError("This domain is not available in the prototype data. Try google.com or paypal-secure-login-update.com.");
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
