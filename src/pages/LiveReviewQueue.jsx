import { useState } from "react";
import Header from "../components/Header";
import { useScanData } from "../context/ScanDataContext";
import { useNavigate } from "react-router-dom";
import { getRiskLevel, getRiskColor } from "../utils/risk";

export default function LiveReviewQueue() {
  const { liveRecords: demoData } = useScanData();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 15;

  const handleClearFilters = () => {
    setSearchTerm("");
    setRiskFilter("All");
    setCurrentPage(1);
  };

  const filteredData = demoData.filter((record) => {
    const matchesSearch = record.domain.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesRisk = true;
    if (riskFilter !== "All") {
      matchesRisk = getRiskLevel(record.risk_score) === riskFilter;
    }

    return matchesSearch && matchesRisk;
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / recordsPerPage));
  const currentRecords = filteredData.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
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
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
        />
        <select 
          className="filter-select" 
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1); }}
        >
          <option value="All">All Risk Levels</option>
          <option value="High">High Risk</option>
          <option value="Medium">Medium Risk</option>
          <option value="Low">Low Risk</option>
        </select>
        <button 
          type="button" 
          className="btn-manual-scan"
          onClick={handleClearFilters}
        >
          CLEAR FILTERS
        </button>
      </section>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ fontSize: "13px" }}>
          Showing {filteredData.length} detection records
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "14px", color: "#64748b" }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: "4px 10px",
              border: "1px solid #e2e8f0",
              backgroundColor: currentPage === 1 ? "#f8fafc" : "#fff",
              color: currentPage === 1 ? "#94a3b8" : "#0f172a",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              borderRadius: "4px"
            }}
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: "4px 10px",
              border: "1px solid #e2e8f0",
              backgroundColor: currentPage === totalPages ? "#f8fafc" : "#fff",
              color: currentPage === totalPages ? "#94a3b8" : "#0f172a",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              borderRadius: "4px"
            }}
          >
            Next
          </button>
        </div>
      </div>

      <section
        className="history-box"
        style={{ overflowX: "auto", padding: "0", border: "none" }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            backgroundColor: "#fff",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#f0f0f0",
                borderBottom: "2px solid #ccc",
              }}
            >
              <th style={{ padding: "12px" }}>ID</th>
              <th style={{ padding: "12px" }}>Domain Name</th>
              <th style={{ padding: "12px" }}>TLD</th>
              <th style={{ padding: "12px" }}>Risk Score</th>
              <th style={{ padding: "12px" }}>Prediction</th>
              <th style={{ padding: "12px" }}>Review Status</th>
              <th style={{ padding: "12px" }}>Decision</th>
              <th style={{ padding: "12px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {currentRecords.length > 0 ? (
              currentRecords.map((record) => (
                <tr key={record.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px" }}>{record.id}</td>
                  <td style={{ padding: "12px", fontWeight: "bold" }}>
                    {record.domain}
                  </td>
                  <td style={{ padding: "12px" }}>{record.tld}</td>
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
                  <td style={{ padding: "12px" }}>{record.review_status || "Pending"}</td>
                  <td style={{ padding: "12px" }}>{record.decision || "-"}</td>
                  <td style={{ padding: "12px" }}>
                    <button
                      onClick={() => navigate(`/review/live/${record.id}`)}
                      style={{
                        padding: "5px 10px",
                        cursor: "pointer",
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                      }}
                    >
                      View Result
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ padding: "12px", textAlign: "center" }}>
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
