import { useState } from "react";
import Header from "../components/Header";
import { useScanData } from "../context/ScanDataContext";
import { getRiskLevel } from "../utils/risk";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function LiveDashboard() {
  const { liveRecords: demoData } = useScanData();

  const chartData = [
    { name: "Mon", detected: 0, critical: 0 },
    { name: "Tue", detected: 0, critical: 0 },
    { name: "Wed", detected: 0, critical: 0 },
    { name: "Thu", detected: 0, critical: 0 },
    { name: "Fri", detected: 0, critical: 0 },
    { name: "Sat", detected: 0, critical: 0 },
    { name: "Sun", detected: 0, critical: 0 },
  ];

  demoData.forEach((d) => {
    const dayIndex = (d.id - 1) % 7;
    chartData[dayIndex].detected += 1;
    if (d.prediction === "Phishing") {
      chartData[dayIndex].critical += 1;
    }
  });
  const [currentPage, setCurrentPage] = useState(1);
  const alertsPerPage = 10;

  const totalPages = Math.max(1, Math.ceil(demoData.length / alertsPerPage));
  const currentAlerts = demoData.slice(
    (currentPage - 1) * alertsPerPage,
    currentPage * alertsPerPage,
  );
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
    Medium: demoData.filter((d) => getRiskLevel(d.risk_score) === "Medium")
      .length,
    High: demoData.filter((d) => getRiskLevel(d.risk_score) === "High").length,
  };

  return (
    <>
      <Header
        title="Live dashboard"
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

      <section
        className="chart-section"
        style={{
          background: "#fff",
          padding: "24px",
          borderRadius: "12px",
          marginBottom: "24px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              Detection trend
            </h2>
            <p
              style={{ margin: "4px 0 0", color: "#64748b", fontSize: "14px" }}
            >
              Newly observed domains across the last seven days
            </p>
          </div>
          <div
            style={{
              color: "#059669",
              fontSize: "14px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
        </div>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                dy={10}
              />
              <YAxis axisLine={false} tickLine={false} tick={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  padding: "12px",
                }}
                labelStyle={{
                  fontWeight: 600,
                  color: "#0f172a",
                  marginBottom: "8px",
                }}
                itemStyle={{ padding: "2px 0", fontSize: "14px" }}
              />
              <Area
                type="monotone"
                dataKey="detected"
                fill="#d1fae5"
                stroke="none"
                fillOpacity={0.5}
              />
              <Line
                type="monotone"
                dataKey="detected"
                name="Detected"
                stroke="#059669"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  fill: "#fff",
                  stroke: "#059669",
                }}
              />
              <Line
                type="monotone"
                dataKey="critical"
                name="Critical"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{
                  r: 4,
                  strokeWidth: 2,
                  fill: "#fff",
                  stroke: "#ef4444",
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="alerts-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0 }}>Recent domain alerts</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "14px", color: "#64748b" }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: "6px 12px",
                border: "1px solid #e2e8f0",
                backgroundColor: currentPage === 1 ? "#f8fafc" : "#fff",
                color: currentPage === 1 ? "#94a3b8" : "#0f172a",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                borderRadius: "4px",
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: "6px 12px",
                border: "1px solid #e2e8f0",
                backgroundColor:
                  currentPage === totalPages ? "#f8fafc" : "#fff",
                color: currentPage === totalPages ? "#94a3b8" : "#0f172a",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                borderRadius: "4px",
              }}
            >
              Next
            </button>
          </div>
        </div>
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
              {currentAlerts.map((alert) => (
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
