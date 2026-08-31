import Header from "../components/Header";

export default function ScanResult() {
  return (
    <>
      <Header 
        title="Scan Result" 
        subtitle="Detailed analysis of the requested domain." 
      />

      {/* 1. Summary Information */}
      <section style={{ border: '1px solid black', padding: '20px', marginBottom: '20px', backgroundColor: '#fff' }}>
        <h2>Summary</h2>
        <ul style={{ listStyle: 'none', padding: 0, fontSize: '1.1em' }}>
          <li style={{ marginBottom: '10px' }}><strong>Domain:</strong> <span>paypal-secure-login-update.com</span></li>
          <li style={{ marginBottom: '10px' }}><strong>Risk Score:</strong> <span style={{ color: 'red', fontWeight: 'bold' }}>92/100</span></li>
          <li style={{ marginBottom: '10px' }}><strong>Prediction:</strong> <span style={{ color: 'red', fontWeight: 'bold' }}>Phishing</span></li>
        </ul>
      </section>

      {/* 2. Feature / Risk Information (Based on docx) */}
      <section style={{ border: '1px solid black', padding: '20px', marginBottom: '20px', backgroundColor: '#fff' }}>
        <h2>Feature & Risk Information</h2>
        <p>Values extracted by the backend ML model:</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0', textAlign: 'left' }}>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Feature</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Detected Value</th>
              <th style={{ padding: '10px', border: '1px solid #ccc' }}>Risk Indicator</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>1. Domain Age</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>2 days old</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'red', fontWeight: 'bold' }}>High Risk</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>2. Registration Period</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>1 year</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'red', fontWeight: 'bold' }}>High Risk</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>3. Domain Length</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>32 characters</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'orange', fontWeight: 'bold' }}>Medium Risk</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>4. Number of Hyphens</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>3 hyphens</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'red', fontWeight: 'bold' }}>High Risk</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>5. Number of Digits</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>0 digits</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'green', fontWeight: 'bold' }}>Low Risk</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>6. Shannon Entropy</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>Low entropy</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'green', fontWeight: 'bold' }}>Low Risk</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>7. Brand Keyword</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>Contains "PayPal"</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'red', fontWeight: 'bold' }}>High Risk</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>8. Typosquatting Similarity</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>Looks like paypal.com</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'red', fontWeight: 'bold' }}>High Risk</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>9. SSL Certificate Age</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>Issued today</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'red', fontWeight: 'bold' }}>High Risk</td>
            </tr>
            <tr>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>10. Top-Level Domain (TLD)</td>
              <td style={{ padding: '10px', border: '1px solid #ccc' }}>.com</td>
              <td style={{ padding: '10px', border: '1px solid #ccc', color: 'green', fontWeight: 'bold' }}>Low Risk</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 3. SHAP Explanation Area */}
      <section style={{ border: '1px solid black', padding: '20px', marginBottom: '20px', backgroundColor: '#fff' }}>
        <h2>SHAP Explanation</h2>
        <p>This shows exactly how the AI made its decision:</p>
        <div style={{ border: '1px dashed black', height: '150px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '10px', backgroundColor: '#f9f9f9', color: '#666' }}>
          [ Waterfall Chart Image will appear here ]
        </div>
      </section>

      {/* 4. Analyst Review Panel (Status, Notes, Decision) */}
      <section style={{ border: '1px solid black', padding: '20px', backgroundColor: '#fff' }}>
        <h2>Analyst Review Panel</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Review Status:</label>
          <select style={{ padding: '8px', width: '100%', maxWidth: '300px', border: '1px solid #ccc' }}>
            <option value="pending">Pending Review</option>
            <option value="investigating">Currently Investigating</option>
            <option value="completed">Review Completed</option>
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Analyst Notes:</label>
          <textarea 
            placeholder="Type your notes about this domain here..." 
            style={{ width: '100%', height: '100px', padding: '10px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Final Review Decision:</label>
          <select style={{ padding: '8px', width: '100%', maxWidth: '300px', border: '1px solid #ccc' }}>
            <option value="unassigned">-- Select Decision --</option>
            <option value="confirmed_phishing">Confirmed Phishing (Block)</option>
            <option value="false_positive">False Positive (Allow)</option>
            <option value="suspicious">Suspicious (Monitor closely)</option>
          </select>
        </div>
        
        <button style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#007bff', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>
          Save Review
        </button>
      </section>
    </>
  );
}
