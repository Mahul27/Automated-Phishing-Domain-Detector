import { Link } from "react-router-dom";
import Header from "../components/Header";
import demoData from "../data/demo_data.json";
import { getRiskLevel } from "../utils/risk";

export default function Dashboard() {
  const domainsMonitored = demoData.length;
  const criticalAlerts = demoData.filter(
    (d) => d.prediction === "Phishing",
  ).length;
  const pendingReview = demoData.filter(
    (d) => d.review_status === "Pending",
  ).length;
  const reviewed = demoData.filter(
    (d) => d.review_status === "Completed",
  ).length;

  const riskDistribution = {
    Low: demoData.filter((d) => getRiskLevel(d.risk_score) === "Low").length,
    Medium: demoData.filter((d) => getRiskLevel(d.risk_score) === "Medium").length,
    High: demoData.filter((d) => getRiskLevel(d.risk_score) === "High").length,
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
          <h3>CRITICAL ALERTS</h3>
          <div className="metric-sub">{criticalAlerts}</div>
        </div>
        <div className="metric-card">
          <h3>PENDING REVIEW</h3>
          <div className="metric-sub">{pendingReview}</div>
        </div>
        <div className="metric-card">
          <h3>REVIEWED</h3>
          <div className="metric-sub">{reviewed}</div>
        </div>
      </section>

      <section className="alerts-section">
        <h2>Recent domain alerts</h2>
        <div className="alerts-table-container" style={{ overflowX: "auto" }}>
          <table
            className="alerts-table"
            style={{
              width: "100%",
              textAlign: "left",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr
                style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}
              >
                <th style={{ padding: "12px 8px" }}>Domain</th>
                <th style={{ padding: "12px 8px" }}>Risk Score</th>
                <th style={{ padding: "12px 8px" }}>Prediction</th>
                <th style={{ padding: "12px 8px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {demoData.map((alert) => (
                <tr key={alert.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 8px" }}>{alert.domain}</td>
                  <td style={{ padding: "12px 8px" }}>{alert.risk_score}</td>
                  <td
                    style={{
                      padding: "12px 8px",
                      color:
                        alert.prediction === "Phishing" ? "#d32f2f" : "#2e7d32",
                      fontWeight: "bold",
                    }}
                  >
                    {alert.prediction}
                  </td>
                  <td style={{ padding: "12px 8px" }}>{alert.review_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bottom-row">
        <div className="info-card">
          <h3>RISK DISTRIBUTION</h3>
          <ul style={{ listStyleType: "none", padding: 0 }}>
            <li style={{ padding: "4px 0" }}>
              Low: <strong>{riskDistribution.Low}</strong>
            </li>
            <li style={{ padding: "4px 0" }}>
              Medium: <strong>{riskDistribution.Medium}</strong>
            </li>
            <li style={{ padding: "4px 0" }}>
              High: <strong>{riskDistribution.High}</strong>
            </li>
          </ul>
        </div>
        <div className="info-card">
          <h3>SYSTEM STATUS</h3>
          <ul>
            <li>Feed collector: active</li>
            <li>Risk scoring: status</li>
            <li>Last data collection: Completed</li>
          </ul>
        </div>
      </section>
    </>
  );
}
