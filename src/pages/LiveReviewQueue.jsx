// This page lets analysts search, filter, review, and export all live detected domains.
import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../components/Header";
import { useNavigate, useOutletContext } from "react-router-dom";
import Button from "../components/Button";
import ApiState from "../components/ApiState";
import { getRiskLevel, getRiskColor } from "../utils/risk";
import { fetchScans } from "../Services/Client";

// Column names used when exporting data to CSV
const columns = [
  "id",
  "domain",
  "tld",
  "risk_score",
  "prediction",
  "review_status",
  "decision",
  "model_outcome",
  "note",
  "scan_time",
  "review_date",
];

// Formats a single cell value safely for CSV export
function csvCell(value) {
  const text = String(value ?? "");
  // Keep exported text (including analyst notes) from becoming spreadsheet formulas.
  const safeText =
    typeof value === "string" && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

// Converts a list of domain records into CSV text
function buildLiveDomainsCsv(records) {
  const rows = records.map((record) => [
    record.id,
    record.domain,
    record.tld || record.domain?.split(".").pop(),
    record.risk_score,
    record.prediction,
    record.review_status || "Pending",
    record.decision,
    record.model_outcome,
    record.note,
    record.scan_time,
    record.review_date,
  ]);
  // UTF-8 BOM lets spreadsheet programs detect Unicode correctly.
  return `\uFEFF${[columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

// Creates and triggers the download of the CSV file in the browser
function downloadLiveDomainsCsv(records) {
  const blob = new Blob([buildLiveDomainsCsv(records)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "live_domains.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Main component for the Live Review Queue page
export default function LiveReviewQueue() {
  const { liveFeed } = useOutletContext();
  const completedFetch = !liveFeed.refreshing && liveFeed.job?.status !== "running"
    ? liveFeed.job?.id
    : null;
  const seenCompletedFetch = useRef(completedFetch);
  // Stored live records and loading/error states
  const [liveRecords, setLiveRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasData, setHasData] = useState(false);

  // Refs to avoid memory leaks and duplicate network calls
  const mounted = useRef(false);
  const readRequest = useRef(null);

  // Fetches live domain scans from the backend API
  const loadRecords = useCallback(async () => {
    if (readRequest.current) return readRequest.current;

    const request = (async () => {
      if (mounted.current) setLoading(true);
      try {
        const scans = await fetchScans("live");
        if (mounted.current) {
          setLiveRecords(scans.records || []);
          setError(null);
          setHasData(true);
        }
      } catch (err) {
        if (mounted.current)
          setError(err.message || "Could not load live results.");
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();

    readRequest.current = request;
    try {
      return await request;
    } finally {
      if (readRequest.current === request) readRequest.current = null;
    }
  }, []);

  // Fetch saved records when the page first loads
  // Read the saved snapshot on entry or an explicit error retry.
  useEffect(() => {
    mounted.current = true;
    loadRecords();
    return () => {
      mounted.current = false;
    };
  }, [loadRecords]);

  // Refresh once after an explicit fetch finishes; preserve the analyst's filters.
  useEffect(() => {
    if (!completedFetch || seenCompletedFetch.current === completedFetch) return;
    seenCompletedFetch.current = completedFetch;
    let cancelled = false;
    const updateRecords = async () => {
      if (readRequest.current) await readRequest.current;
      if (!cancelled && mounted.current) await loadRecords();
    };
    updateRecords();
    return () => { cancelled = true; };
  }, [completedFetch, loadRecords]);

  const navigate = useNavigate();

  // Search input and dropdown filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 15;

  // Reset all filters back to default values
  const handleClearFilters = () => {
    setSearchTerm("");
    setRiskFilter("All");
    setStatusFilter("All");
    setCurrentPage(1);
  };

  // Filter records by domain search text, risk score, and review status
  const filteredData = liveRecords.filter((record) => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    // Check if domain or record ID matches search input
    const domainText = (record.domain || "").toLowerCase();
    const idText = (record.id || "").toString().toLowerCase();

    const matchesSearch =
      domainText.includes(cleanSearch) || idText.includes(cleanSearch);

    // Check risk level filter (High, Medium, Low)
    let matchesRisk = true;
    if (riskFilter !== "All") {
      matchesRisk = getRiskLevel(record.risk_score) === riskFilter;
    }

    // Check review status and decision filter
    let matchesStatus = true;
    if (statusFilter === "Pending review") {
      matchesStatus = record.review_status !== "Completed";
    } else if (statusFilter === "Reviewed · all decisions") {
      matchesStatus = record.review_status === "Completed";
    } else if (statusFilter === "Confirmed phishing") {
      matchesStatus =
        record.review_status === "Completed" &&
        record.decision === "Confirmed Phishing";
    } else if (statusFilter === "Not phishing") {
      matchesStatus =
        record.review_status === "Completed" &&
        record.decision === "Confirmed Legitimate";
    }

    return matchesSearch && matchesRisk && matchesStatus;
  });

  // Calculate total pages and records for the current page view
  const totalPages = Math.max(
    1,
    Math.ceil(filteredData.length / recordsPerPage),
  );
  const displayPage = Math.min(currentPage, totalPages);
  const currentRecords = filteredData.slice(
    (displayPage - 1) * recordsPerPage,
    displayPage * recordsPerPage,
  );

  return (
    <>
      {/* Top page header */}
      <Header
        title="Live review queue"
        subtitle="Search and review domains detected by the OpenSquat live feed."
      />

      {/* Filter and search toolbar */}
      <section className="filter-row">
        {/* Domain or ID search input */}
        <input
          type="text"
          className="search-input"
          placeholder="Search by domain"
          aria-label="Search live domains or record ID"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
        />
        {/* Risk level filter dropdown */}
        <select
          className="filter-select"
          aria-label="Filter live domains by risk level"
          value={riskFilter}
          onChange={(e) => {
            setRiskFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All Risk Levels</option>
          <option value="High">High Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="Low">Low Risk</option>
        </select>
        {/* Review status filter dropdown */}
        <select
          className="filter-select"
          aria-label="Filter live domains by review status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="All">All review statuses</option>
          <option value="Pending review">Pending review</option>
          <option value="Reviewed · all decisions">
            Reviewed &middot; all decisions
          </option>
          <option value="Confirmed phishing">Confirmed phishing</option>
          <option value="Not phishing">Not phishing</option>
        </select>
        {/* Clear filters button */}
        <Button variant="outline" size="small" onClick={handleClearFilters}>
          CLEAR FILTERS
        </Button>
        {/* Export to CSV button */}
        <Button
          variant="primary"
          size="small"
          onClick={() => downloadLiveDomainsCsv(liveRecords)}
          disabled={loading || liveRecords.length === 0}
        >
          EXPORT ALL CSV
        </Button>
      </section>

      {/* Warning message if using cached data after a fetch failure */}
      {error && hasData && (
        <p className="live-feed-warning">
          Showing the last saved results. The latest update failed.
        </p>
      )}
      {/* Loading spinner or retry box */}
      <ApiState loading={loading} error={error} onRetry={loadRecords} />

      {hasData && (
        <>
          {/* Results counter and pagination controls */}
          <div
            className="records-toolbar"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ fontSize: "13px" }}>
              Showing {filteredData.length} detection records
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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

          {/* Table displaying filtered live domain records */}
          <section
            className="history-box"
            style={{ overflowX: "auto", padding: "0", border: "none" }}
          >
            <table className="app-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Domain Name</th>
                  <th>TLD</th>
                  <th>Risk Score</th>
                  <th>Prediction</th>
                  <th>Review Status</th>
                  <th>Analyst Decision</th>
                  <th>Model Outcome</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {/* Render each domain row */}
                {currentRecords.length > 0 ? (
                  currentRecords.map((record) => (
                    <tr
                      key={record.id}
                      style={{ borderBottom: "1px solid #eee" }}
                    >
                      <td>{record.id}</td>
                      <td>{record.domain}</td>
                      <td>{record.tld || record.domain.split(".").pop()}</td>
                      <td
                        style={{
                          padding: "12px",
                          color: getRiskColor(record.risk_score),
                          fontWeight: "bold",
                        }}
                      >
                        {record.risk_score}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color:
                            record.prediction?.toLowerCase() === "phishing"
                              ? "red"
                              : record.prediction?.toLowerCase() ===
                                  "legitimate"
                                ? "green"
                                : "inherit",
                          fontWeight: "bold",
                        }}
                      >
                        {record.prediction}
                      </td>
                      <td>{record.review_status || "Pending"}</td>
                      <td>{record.decision || "-"}</td>
                      <td>{record.model_outcome || "-"}</td>
                      <td>
                        <Button
                          variant="primary"
                          size="small"
                          onClick={() => navigate(`/review/live/${record.id}`)}
                        >
                          View Result
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  /* Empty state message when no records match */
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center" }}>
                      {liveRecords.length === 0
                        ? "No live domains have been saved yet. Use Fetch new domains to check the OpenSquat feed."
                        : "No records found matching your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
