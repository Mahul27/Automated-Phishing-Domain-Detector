import { Link } from "react-router-dom";

export default function ManualScan() {
  return (
    <>
      <div className="header-row">
        <div className="header-title">
          <h1>Manual Domain Scan</h1>
          <p>
            Paste any domain to request a risk score and explainability
            result.
          </p>
        </div>
      </div>

      <section className="scan-box">
        <h2>Enter a domain</h2>
        <div className="scan-input-group">
          <label>Domain name or URL</label>
          <div className="scan-input-row">
            <input type="text" />
            <Link
              to="/result"
              className="btn-scan"
              style={{
                textDecoration: "none",
                display: "inline-block",
                textAlign: "center",
                color: "black",
                padding: "10px 24px",
                boxSizing: "border-box",
              }}
            >
              SCAN DOMAIN
            </Link>
          </div>
        </div>
      </section>

      <section className="state-boxes">
        <div className="state-box">
          <strong>VALIDATION STATE</strong>
          <p>
            Please enter a valid domain. Remove spaces or unsupported
            characters.
          </p>
        </div>
        <div className="state-box">
          <strong>LOADING STATE</strong>
          <p>Scanning domain...</p>
          <p>Extracting lexical, WHOIS, SSL, DNS, and hosting features.</p>
        </div>
      </section>

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
