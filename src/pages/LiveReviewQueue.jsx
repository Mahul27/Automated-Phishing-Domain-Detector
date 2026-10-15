import { useCallback, useEffect, useRef, useState } from "react";
import Header from "../components/Header";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import ApiState from "../components/ApiState";
import { getRiskLevel, getRiskColor } from "../utils/risk";
import { fetchScans } from "../Services/Client";

const columns = [
  "id",
  "domain",
  "tld",
  "risk_score",
  "prediction",
  "review_status",
  "decision",
  "note",
  "scan_time",
  "review_date",
];

function csvCell(value) {
  const text = String(value ?? "");
  // Keep exported text (including analyst notes) from becoming spreadsheet formulas.
  const safeText =
    typeof value === "string" && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function buildLiveDomainsCsv(records) {
  const rows = records.map((record) => [
    record.id,
    record.domain,
    record.tld || record.domain?.split(".").pop(),
    record.risk_score,
    record.prediction,
    record.review_status || "Pending",
    record.decision,
    record.note,
    record.scan_time,
    record.review_date,
  ]);
  // UTF-8 BOM lets spreadsheet programs detect Unicode correctly.
  return `\uFEFF${[columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

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

export default function LiveReviewQueue() {
  const [liveRecords, setLiveRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasData, setHasData] = useState(false);
  const mounted = useRef(false);
  const hasLoaded = useRef(false);
  const readRequest = useRef(null);

  const loadRecords = useCallback(async () => {
    if (readRequest.current) return readRequest.current;

    const request = (async () => {
      if (mounted.current) setLoading(!hasLoaded.current);
      try {
        const scans = await fetchScans("live");
        if (mounted.current) {
          setLiveRecords(scans.records || []);
          setError(null);
          setHasData(true);
          hasLoaded.current = true;
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

  // Read the saved snapshot on entry or an explicit error retry.
  useEffect(() => {
    mounted.current = true;
    loadRecords();
    return () => {
      mounted.current = false;
    };
  }, [loadRecords]);

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 15;

  const handleClearFilters = () => {
    setSearchTerm("");
    setRiskFilter("All");
    setStatusFilter("All");
    setCurrentPage(1);
  };

  const filteredData = liveRecords.filter((record) => {
    const cleanSearch = searchTerm.trim().toLowerCase();

    const domainText = (record.domain || "").toLowerCase();
    const idText = (record.id || "").toString().toLowerCase();

    const matchesSearch =
      domainText.includes(cleanSearch) || idText.includes(cleanSearch);

    let matchesRisk = true;
    if (riskFilter !== "All") {
      matchesRisk = getRiskLevel(record.risk_score) === riskFilter;
    }

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
        record.decision === "False Positive";
    }

    return matchesSearch && matchesRisk && matchesStatus;
  });

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
      <Header
        title="Live review queue"
        subtitle="Search and review domains detected by the OpenSquat live feed."
      />

      <section className="filter-row">
        <input
          type="text"
          className="search-input"
          placeholder="Search by domain"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
        />
        <select
          className="filter-select"
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
        <select
          className="filter-select"
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
        <Button variant="outline" size="small" onClick={handleClearFilters}>
          CLEAR FILTERS
        </Button>
        <Button
          variant="primary"
          size="small"
          onClick={() => downloadLiveDomainsCsv(liveRecords)}
          disabled={loading || liveRecords.length === 0}
        >
          EXPORT ALL CSV
        </Button>
      </section>

      {error && hasData && (
        <p className="live-feed-warning">
          Showing the last saved results. The latest update failed.
        </p>
      )}
      <ApiState loading={loading} error={error} onRetry={loadRecords} />

      {hasData && (
        <>
          <div
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
                  <th>Decision</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
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
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center" }}>
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
