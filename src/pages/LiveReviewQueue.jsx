import { useState } from "react";
import Header from "../components/Header";
import { useScanData } from "../context/ScanDataContext";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { getRiskLevel, getRiskColor } from "../utils/risk";

export default function LiveReviewQueue() {
  const { liveRecords: demoData } = useScanData();
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

  const filteredData = demoData.filter((record) => {
    const matchesSearch = record.domain
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

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
  const currentRecords = filteredData.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage,
  );

  return (
    <>
      <Header
        title="Live review queue"
        subtitle="Search and review earlier detection records."
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
      </section>

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
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
                <tr key={record.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{record.id}</td>
                  <td>{record.domain}</td>
                  <td>{record.tld}</td>
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
                      color: getRiskColor(record.risk_score),
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
                  No records found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
