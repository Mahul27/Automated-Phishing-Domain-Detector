import { useState, useEffect } from "react";
import Header from "../components/Header";
import { fetchDashboardSummary, fetchScans } from "../Services/api";
import Button from "../components/Button";
import ApiState from "../components/ApiState";
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
  const [summaryData, setSummaryData] = useState(null);
  const [liveRecords, setLiveRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const alertsPerPage = 10;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, scansRes] = await Promise.all([
        fetchDashboardSummary(),
        fetchScans("live"),
      ]);
      setSummaryData(summaryRes);
      setLiveRecords(scansRes.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalPages = Math.max(1, Math.ceil(liveRecords.length / alertsPerPage));
  const currentAlerts = liveRecords.slice(
    (currentPage - 1) * alertsPerPage,
    currentPage * alertsPerPage,
  );

  return (
    <>
      <Header
        title="Live dashboard"
        subtitle="Live overview of newly registered domains and flagged alerts"
      />

      <ApiState loading={loading} error={error} onRetry={loadData} />

      {!loading && !error && summaryData && (
        <>
          <section className="metrics-row">
            <div className="metric-card">
              <h3>DOMAINS MONITORED</h3>
              <div className="metric-sub">{summaryData.domains_monitored}</div>
            </div>
            <div className="metric-card">
              <h3>HIGH-RISK ALERTS</h3>
              <div className="metric-sub">{summaryData.high_risk_alerts}</div>
            </div>
            <div className="metric-card">
              <h3>PENDING REVIEW</h3>
              <div className="metric-sub">{summaryData.pending_review}</div>
            </div>
            <div className="metric-card">
              <h3>REVIEWED</h3>
              <div className="metric-sub">{summaryData.reviewed}</div>
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
                  style={{
                    margin: "4px 0 0",
                    color: "#64748b",
                    fontSize: "14px",
                  }}
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
                  data={summaryData.weekly_trend || []}
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

          <section className="bottom-row">
            <div className="info-card">
              <h3 style={{ marginBottom: "16px" }}>RISK DISTRIBUTION</h3>
              {(() => {
                const rd = summaryData.risk_distribution || {
                  Low: 0,
                  Medium: 0,
                  High: 0,
                };
                const totalRisk = rd.Low + rd.Medium + rd.High;
                const lowPercent =
                  totalRisk > 0 ? (rd.Low / totalRisk) * 100 : 0;
                const mediumPercent =
                  totalRisk > 0 ? (rd.Medium / totalRisk) * 100 : 0;
                const highPercent =
                  totalRisk > 0 ? (rd.High / totalRisk) * 100 : 0;

                return (
                  <>
                    <div
                      style={{
                        display: "flex",
                        width: "100%",
                        height: "20px",
                        borderRadius: "10px",
                        overflow: "hidden",
                        marginBottom: "16px",
                        backgroundColor: "#e2e8f0",
                      }}
                    >
                      <div
                        style={{
                          width: `${lowPercent}%`,
                          backgroundColor: "#22c55e",
                          transition: "width 0.3s ease",
                        }}
                        title={`Low: ${rd.Low}`}
                      />
                      <div
                        style={{
                          width: `${mediumPercent}%`,
                          backgroundColor: "#f59e0b",
                          transition: "width 0.3s ease",
                        }}
                        title={`Medium: ${rd.Medium}`}
                      />
                      <div
                        style={{
                          width: `${highPercent}%`,
                          backgroundColor: "#ef4444",
                          transition: "width 0.3s ease",
                        }}
                        title={`High: ${rd.High}`}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        color: "#64748b",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            backgroundColor: "#22c55e",
                            borderRadius: "50%",
                          }}
                        />
                        <span>
                          Low <strong>{rd.Low}</strong>
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            backgroundColor: "#f59e0b",
                            borderRadius: "50%",
                          }}
                        />
                        <span>
                          Medium <strong>{rd.Medium}</strong>
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            width: "10px",
                            height: "10px",
                            backgroundColor: "#ef4444",
                            borderRadius: "50%",
                          }}
                        />
                        <span>
                          High <strong>{rd.High}</strong>
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
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
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <span style={{ fontSize: "14px", color: "#64748b" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="default"
                  size="small"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="default"
                  size="small"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
            <div
              className="alerts-table-container"
              style={{ overflowX: "auto" }}
            >
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Risk Score</th>
                    <th>Prediction</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      style={{ borderBottom: "1px solid #eee" }}
                    >
                      <td>{alert.domain}</td>
                      <td>{alert.risk_score}</td>
                      <td
                        style={{
                          padding: "12px 8px",
                          color:
                            alert.prediction === "Phishing"
                              ? "#d32f2f"
                              : "#2e7d32",
                          fontWeight: "bold",
                        }}
                      >
                        {alert.prediction}
                      </td>
                      <td>{alert.review_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
