// This page displays real-time phishing feed data, key metrics, detection trends, and recent alerts.
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Header from "../components/Header";
import Button from "../components/Button";
import ApiState from "../components/ApiState";
import { getRiskColor } from "../utils/risk";
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

// Controls toolbar: pick domain count, trigger fetch, and view status
function LiveFeedControls({ feed }) {
  // Number of domains to fetch (defaults to 10)
  const [limit, setLimit] = useState(10);
  const source = feed.health?.opensquat;
  const unavailable = source?.status === "unavailable";
  const busy = feed.refreshing;
  const selectedLimit = busy && feed.job?.limit ? feed.job.limit : limit;
  const result = feed.refreshResult;
  const lastFetch = result?.last_fetch_at || source?.last_fetch_at;
  const lastFetchDate = lastFetch ? new Date(lastFetch) : null;
  const hasFetchTime = lastFetchDate && !Number.isNaN(lastFetchDate.getTime());
  const feedback = feed.feedback;

  return (
    <section className="state-box live-feed-controls">
      {/* Top toolbar with count selector and fetch button */}
      <div className="live-feed-toolbar" aria-busy={busy}>
        <div>
          <h2>OpenSquat live domains</h2>
          <p>
            Choose the maximum number of new domains to scan, then select Fetch
            new domains. Results stay unchanged while you review them and update
            after your fetch finishes.
          </p>
          <p className="live-feed-updated">
            Last domain fetch:{" "}
            {hasFetchTime ? lastFetchDate.toLocaleString() : "Not recorded yet"}
          </p>
        </div>
        <div className="live-feed-actions">
          <label className="live-feed-limit">
            New domains per fetch
            <select
              value={selectedLimit}
              onChange={(event) => setLimit(Number(event.target.value))}
              disabled={busy}
            >
              {[10, 25, 50].map((count) => (
                <option key={count} value={count}>
                  {count.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            onClick={() => feed.refresh(limit)}
            disabled={busy || unavailable || feed.loading || feed.checkingStatus || !feed.health}
          >
            {busy
              ? feed.job?.status !== "running"
                ? "UPDATING RESULTS…"
                : "FETCHING DOMAINS…"
              : "FETCH NEW DOMAINS"}
          </Button>
        </div>
      </div>

      {/* Warning shown when OpenSquat is offline or unreachable */}
      {unavailable && (
        <p role="alert" className="live-feed-error">
          OpenSquat is unavailable:{" "}
          {source.reason || "The backend feed needs configuration."}
        </p>
      )}
      {/* Feedback message shown after a fetch completes */}
      {!busy && feedback && (
        <div
          role={feedback.tone === "success" ? "status" : "alert"}
          className={`live-feed-${feedback.tone}`}
        >
          <p>{feedback.title}</p>
          {feedback.detail && <p>{feedback.detail}</p>}
          {feedback.warning && <p>{feedback.warning}</p>}
        </div>
      )}
    </section>
  );
}

// Main Live Dashboard page component
export default function LiveDashboard() {
  const navigate = useNavigate();
  // Live feed hook containing records, metrics, and actions
  const { liveFeed: feed } = useOutletContext();
  const { reload } = feed;

  // Read a saved snapshot on entry; fetch tracking lives in the shared layout.
  useEffect(() => {
    reload();
  }, [reload]);
  const { summary: summaryData, records: liveRecords } = feed;

  // Pagination for the recent domains table
  const [currentPage, setCurrentPage] = useState(1);
  const alertsPerPage = 10;

  // Calculate page numbers and slice current records
  const totalPages = Math.max(1, Math.ceil(liveRecords.length / alertsPerPage));
  const displayPage = Math.min(currentPage, totalPages);
  const currentAlerts = liveRecords.slice(
    (displayPage - 1) * alertsPerPage,
    displayPage * alertsPerPage,
  );

  return (
    <>
      {/* Page header */}
      <Header
        title="Live dashboard"
        subtitle={
          feed.health?.model?.mode === "heuristic"
            ? "OpenSquat live domains · Fallback risk scores while the trained model is unavailable"
            : "Live overview of domains detected by OpenSquat and saved for review"
        }
      />

      {/* Domain fetch controls and status */}
      <LiveFeedControls feed={feed} />
      {/* Warning shown when latest update failed but saved data is still visible */}
      {feed.error && feed.hasData && (
        <p className="live-feed-warning">
          Showing the last saved results. The latest update failed.
        </p>
      )}
      {/* Loading state or error retry prompt */}
      <ApiState
        loading={feed.loading}
        error={feed.error}
        onRetry={feed.reload}
      />

      {summaryData && (
        <>
          {/* Key metric cards (Monitored, Alerts, Pending, Reviewed) */}
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

          {/* 7-day cumulative detection trend chart */}
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
                  Cumulative monitored domains across the last seven days
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
                    dataKey="monitored"
                    fill="#d1fae5"
                    stroke="none"
                    fillOpacity={0.5}
                    tooltipType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="monitored"
                    name="Monitored"
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
                    dataKey="high_risk"
                    name="High risk"
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

          {/* Risk distribution breakdown and manual investigation CTA */}
          <section className="bottom-row">
            {/* Risk distribution percentage bar and counts */}
            <div className="info-card">
              <h3 style={{ marginBottom: "16px" }}>RISK DISTRIBUTION</h3>
              {(() => {
                // Calculate percentage share for each risk category
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
                    {/* Visual stacked progress bar */}
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

                    {/* Legend showing count per risk level */}
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
            {/* Quick link to manual search workspace */}
            <div className="info-card">
              <h3>MANUAL INVESTIGATION</h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "#64748b",
                  marginBottom: "15px",
                }}
              >
                Need to investigate a specific domain? You can run a manual scan
                or import domains from a file.
              </p>
              <Button
                variant="primary"
                onClick={() =>
                  navigate("/workspace", {
                    state: { activeTab: "manual_search" },
                  })
                }
                style={{ maxWidth: "100%" }}
              >
                Go to Manual Search
              </Button>
            </div>
          </section>

          {/* Table of recent live scanned domains */}
          <section className="alerts-section">
            <div
              className="records-toolbar"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h2 style={{ margin: 0 }}>Recent live domains</h2>
              {/* Pagination controls */}
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <span style={{ fontSize: "14px", color: "#64748b" }}>
                  Page {displayPage} of {totalPages}
                </span>
                <Button
                  variant="default"
                  size="small"
                  disabled={displayPage === 1}
                  onClick={() => setCurrentPage(Math.max(1, displayPage - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="default"
                  size="small"
                  disabled={displayPage === totalPages}
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, displayPage + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
            {/* Scanned domains list */}
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
                    <th>Recorded</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      style={{ borderBottom: "1px solid #eee" }}
                    >
                      <td>{alert.domain}</td>
                      <td
                        style={{
                          color: getRiskColor(alert.risk_score),
                          fontWeight: "bold",
                        }}
                      >
                        {alert.risk_score}
                      </td>
                      <td
                        style={{
                          padding: "12px 8px",
                          color:
                            alert.prediction?.toLowerCase() === "phishing"
                              ? "red"
                              : alert.prediction?.toLowerCase() === "legitimate"
                                ? "green"
                                : "inherit",
                          fontWeight: "bold",
                        }}
                      >
                        {alert.prediction}
                      </td>
                      <td>{alert.review_status || "Pending"}</td>
                      <td>
                        {alert.scan_time
                          ? new Date(alert.scan_time).toLocaleString()
                          : "Unknown"}
                      </td>
                      <td>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => navigate(`/review/live/${alert.id}`)}
                        >
                          View result
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {currentAlerts.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        style={{ textAlign: "center", padding: "24px" }}
                      >
                        No live domains have been saved yet. Use Fetch new
                        domains to check the OpenSquat feed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Link to view the complete live review queue */}
            <Button
              variant="outline"
              onClick={() => navigate("/queue")}
              style={{ marginTop: "15px" }}
            >
              OPEN LIVE REVIEW QUEUE
            </Button>
          </section>
        </>
      )}
    </>
  );
}
