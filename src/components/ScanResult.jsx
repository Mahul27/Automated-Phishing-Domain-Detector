import Sidebar from './Sidebar';

export default function ScanResult() {
  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        <div className="header-row">
          <div className="header-title">
            <h1>Scan Result</h1>
            <p>Detailed analysis of the requested domain.</p>
          </div>
        </div>

        <section className="result-box" style={{ border: '1px solid black', padding: '20px', marginBottom: '20px' }}>
          <h2>Scan Summary</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '10px' }}><strong>Domain:</strong> example-phishing-site.com</li>
            <li style={{ marginBottom: '10px' }}><strong>Risk score (0-100):</strong> 87</li>
            <li style={{ marginBottom: '10px' }}><strong>Prediction:</strong> Phishing</li>
            <li style={{ marginBottom: '10px' }}><strong>Timestamp:</strong> 2026-08-26 18:25:10</li>
          </ul>
        </section>

        <section className="shap-box" style={{ border: '1px solid black', padding: '20px' }}>
          <h2>SHAP Explanation</h2>
          <p>This section shows why the model made this prediction. Key factors influencing the risk score:</p>
          <ul style={{ marginTop: '10px', marginLeft: '20px' }}>
            <li>High number of hyphens in domain name (+15 risk)</li>
            <li>Recently registered domain (+30 risk)</li>
            <li>SSL certificate from non-trusted issuer (+25 risk)</li>
          </ul>
          <div style={{ border: '1px dashed black', height: '150px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '20px' }}>
            [ Placeholder for SHAP Waterfall Chart ]
          </div>
        </section>
      </main>
    </div>
  );
}
