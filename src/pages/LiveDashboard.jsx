// This page displays real-time phishing feed data, key metrics, detection trends, and recent alerts.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Button from "../components/Button";
import ApiState from "../components/ApiState";
import { getRiskColor } from "../utils/risk";
import {
  checkBackendHealth,
  fetchDashboardSummary,
  fetchScans,
  refreshLiveDomains,
} from "../Services/Client";
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

// Friendly error messages for feed fetch issues
const ERROR_MESSAGES = {
  invalid_limit: "Choose between 1 and 2,000 new domains per fetch.",
  refresh_in_progress:
    "A live feed refresh is already running. Try again once it completes.",
  feed_timeout:
    "The OpenSquat feed took too long to respond. Please try again later.",
  feed_unavailable:
    "Could not fetch the OpenSquat feed. Please try again later.",
  database_unavailable:
    "Could not access saved live results. Please try again later.",
  request_failed:
    "The live feed request failed. Check that the backend is running, then try again.",
};

// Helper function to make sure counts are valid positive numbers
function safeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

// Builds a short feedback message (success, warning, or error) after a feed refresh
// Display controlled messages, including when an older backend returns raw SQL.
function liveFeedFeedback(result) {
  if (!result) return null;

  const added = safeCount(result.added_count);
  const failed = safeCount(result.failed_count);
  const scanError =
    failed > 0
      ? `${failed} ${failed === 1 ? "domain" : "domains"} could not be scanned. Please try fetching again later.`
      : "Some domains could not be scanned. Please try fetching again later.";

  if (result.status !== "success") {
    return {
      tone: "error",
      title:
        "The live feed refresh did not complete. Saved results are still available.",
      detail:
        failed > 0
          ? scanError
          : Object.hasOwn(ERROR_MESSAGES, result.error_code)
            ? ERROR_MESSAGES[result.error_code]
            : "Could not fetch and scan new domains. Please try again later.",
      warning: null,
    };
  }

  const detail = failed > 0 || result.error ? scanError : null;
  const warning =
    result.warning_code === "fetch_time_not_saved"
      ? "The last fetch time could not be saved. Saved domain results are still available."
      : result.warning
        ? "The refresh completed with a warning. Saved domain results are still available."
        : null;

  return {
    tone: detail || warning ? "warning" : "success",
    title:
      added === 0
        ? "The feed was checked. No new domains were added."
        : `${added} new ${added === 1 ? "domain was" : "domains were"} scanned and added to the live results.`,
    detail,
    warning,
  };
}

// Custom hook that manages all data and actions for the live dashboard
function useLiveDashboardFeed() {
  // Scanned domains, dashboard summary, and backend health status
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);

  // Loading and error states
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Refresh progress and feedback result
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);

  // Refs to avoid duplicate requests and prevent state updates after unmount
  const mounted = useRef(false);
  const hasLoaded = useRef(false);
  const readRequest = useRef(null);
  const healthRequest = useRef(null);
  const refreshRequest = useRef(false);

  // Checks if the backend server is online and healthy
  const updateHealth = useCallback(() => {
    if (healthRequest.current) return healthRequest.current;
    const request = checkBackendHealth()
      .then((backendHealth) => {
        if (mounted.current) setHealth(backendHealth);
      })
      .catch(() => {
        if (mounted.current) setHealth(null);
      })
      .finally(() => {
        if (healthRequest.current === request) healthRequest.current = null;
      });
    healthRequest.current = request;
    return request;
  }, []);

  // Loads saved live scans and summary statistics from backend
  const reload = useCallback(async () => {
    if (readRequest.current) return readRequest.current;

    const request = (async () => {
      if (mounted.current) {
        setLoading(!hasLoaded.current);
      }
      // Readiness updates independently, even if saved results cannot be read.
      updateHealth();
      try {
        const [scans, dashboard] = await Promise.all([
          fetchScans("live"),
          fetchDashboardSummary(),
        ]);
        if (mounted.current) {
          setRecords(scans.records || []);
          setSummary(dashboard);
          setError(null);
          setHasData(true);
          hasLoaded.current = true;
        }
        return true;
      } catch (err) {
        if (mounted.current)
          setError(err.message || "Could not load live results.");
        return false;
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    })();

    readRequest.current = request;
    try {
      return await request;
    } finally {
      if (readRequest.current === request) readRequest.current = null;
    }
  }, [updateHealth]);

  // Load initial data when the dashboard first opens
  useEffect(() => {
    mounted.current = true;
    reload();

    return () => {
      mounted.current = false;
    };
  }, [reload]);

  // Fetches new domains from OpenSquat and runs scans on them
  const refresh = async (limit) => {
    if (refreshRequest.current || !mounted.current) return;
    refreshRequest.current = true;
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const result = await refreshLiveDomains(limit);
      if (result.status !== "success" && result.status !== "failed") {
        throw new Error(
          "The live feed returned an unexpected response. Try Fetch new domains again.",
        );
      }
      // OpenSquat failures can use HTTP 200; preserve the result status and error.
      if (mounted.current) setRefreshResult(result);
    } catch {
      if (mounted.current) {
        setRefreshResult({
          status: "failed",
          added_count: 0,
          error_code: "request_failed",
        });
      }
    } finally {
      // Re-read saved data even after a failed run, which may have saved scans.
      if (readRequest.current) await readRequest.current;
      if (mounted.current) await reload();
      refreshRequest.current = false;
      if (mounted.current) setRefreshing(false);
    }
  };

  return {
    records,
    summary,
    health,
    hasData,
    loading,
    error,
    refreshing,
    refreshResult,
    reload,
    refresh,
  };
}

// Show activity and actual waiting time without estimating backend progress.
function LiveFetchProgress({ limit, updating }) {
  const [startedAt] = useState(Date.now);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [startedAt]);

  const elapsed = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="live-feed-progress">
      <div className="live-feed-progress-header">
        <p role="status" className="live-feed-progress-title">
          {updating
            ? "Updating dashboard results…"
            : `Fetching and scanning up to ${limit.toLocaleString()} new domains…`}
        </p>
        <span className="live-feed-elapsed" aria-live="off">
          Time elapsed: {elapsed}
        </span>
      </div>
      <div
        className="live-feed-progress-track"
        role="progressbar"
        aria-label={updating ? "Loading saved results" : "Fetching new domains"}
        aria-describedby="live-feed-progress-hint"
      >
        <span className="live-feed-progress-indicator" />
      </div>
      <p id="live-feed-progress-hint" className="live-feed-progress-hint">
        {updating
          ? "Loading the latest saved results. Please keep this page open."
          : "Fetching and scanning can take several minutes, especially for larger batches. Please keep this page open; your results will appear when it finishes."}
      </p>
    </div>
  );
}

// Controls toolbar: pick domain count, trigger fetch, and view status
function LiveFeedControls({ feed }) {
  // Number of domains to fetch (defaults to 10)
  const [limit, setLimit] = useState(10);
  const source = feed.health?.opensquat;
  const unavailable = source?.status === "unavailable";
  const busy = feed.refreshing;
  const result = feed.refreshResult;
  const lastFetch = result?.last_fetch_at || source?.last_fetch_at;
  const lastFetchDate = lastFetch ? new Date(lastFetch) : null;
  const hasFetchTime = lastFetchDate && !Number.isNaN(lastFetchDate.getTime());
  const feedback = liveFeedFeedback(result);

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
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              disabled={busy}
            >
              {[10, 25, 50, 100, 200, 500, 1000, 2000].map((count) => (
                <option key={count} value={count}>
                  {count.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            onClick={() => feed.refresh(limit)}
            disabled={busy || unavailable || feed.loading}
          >
            {busy
              ? result
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
      {/* Progress message shown while fetching is running */}
      {busy && <LiveFetchProgress limit={limit} updating={Boolean(result)} />}
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
  const feed = useLiveDashboardFeed();
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
                style={{ width: "25%" }}
              >
                Go to Manual Search
              </Button>
            </div>
          </section>

          {/* Table of recent live scanned domains */}
          <section className="alerts-section">
            <div
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
