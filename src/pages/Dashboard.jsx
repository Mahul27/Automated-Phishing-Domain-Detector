import { Link } from 'react-router-dom';
import Header from '../components/Header';
import demoData from '../data/demo_data.json';

export default function Dashboard() {
  const domainsMonitored = demoData.length;
  const highRiskAlerts = demoData.filter(d => d.prediction === "Phishing").length;
  const averageRiskScore = Math.round(demoData.reduce((acc, d) => acc + d.risk_score, 0) / demoData.length);

  const riskDistribution = {
    Low: demoData.filter(d => d.risk_score < 40).length,
    Medium: demoData.filter(d => d.risk_score >= 40 && d.risk_score < 75).length,
    High: demoData.filter(d => d.risk_score >= 75).length,
  };

  return (
    <>
      <Header 
        title="Dashboard" 
        subtitle="Live overview of newly registered domains and flagged alerts" 
      />

      <section className="metrics-row">
        <div className="metric-card">
          <h3>DOMAINS MONITORED</h3>
          <div className="metric-sub">{domainsMonitored}</div>
        </div>
        <div className="metric-card">
          <h3>HIGH RISK ALERTS</h3>
          <div className="metric-sub">{highRiskAlerts}</div>
        </div>
        <div className="metric-card">
          <h3>AVERAGE RISK SCORE</h3>
          <div className="metric-sub">{averageRiskScore}</div>
        </div>
      </section>

      <section className="metrics-row">
        <div className="metric-card" style={{ backgroundColor: '#f9f9f9' }}>
          <h3>openSquat / openphish</h3>
          <div className="metric-sub">Active Source</div>
        </div>
        <div className="metric-card" style={{ backgroundColor: '#f9f9f9' }}>
          <h3>phishtank / CT logs</h3>
          <div className="metric-sub">Active Source</div>
        </div>
        <div className="metric-card" style={{ backgroundColor: '#f9f9f9' }}>
          <h3>NZ legitimate list</h3>
          <div className="metric-sub">Active Source</div>
        </div>
      </section>

      <section className="alerts-section">
        <h2>Recent domain alerts</h2>
        <div className="alerts-table-container" style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', padding: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <table className="alerts-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '12px 8px' }}>Domain</th>
                <th style={{ padding: '12px 8px' }}>Risk Score</th>
                <th style={{ padding: '12px 8px' }}>Prediction</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {demoData.map((alert) => (
                <tr key={alert.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px 8px' }}>{alert.domain}</td>
                  <td style={{ padding: '12px 8px' }}>{alert.risk_score}</td>
                  <td style={{ padding: '12px 8px', color: alert.prediction === 'Phishing' ? '#d32f2f' : '#2e7d32', fontWeight: 'bold' }}>{alert.prediction}</td>
                  <td style={{ padding: '12px 8px' }}>{alert.review_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bottom-row">
        <div className="info-card">
          <h3>RISK DISTRIBUTION</h3>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            <li style={{ padding: '4px 0' }}>Low: <strong>{riskDistribution.Low}</strong></li>
            <li style={{ padding: '4px 0' }}>Medium: <strong>{riskDistribution.Medium}</strong></li>
            <li style={{ padding: '4px 0' }}>High: <strong>{riskDistribution.High}</strong></li>
          </ul>
        </div>
        <div className="info-card">
          <h3>SYSTEM STATUS</h3>
          <ul>
            <li>• Feed collector: active</li>
            <li>• Risk scoring: status</li>
            <li>• Last data collection: Completed</li>
          </ul>
        </div>
      </section>
    </>
  );
}
