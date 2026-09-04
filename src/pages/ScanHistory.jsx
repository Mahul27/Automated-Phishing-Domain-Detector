import { useState } from "react";
import Header from "../components/Header";
import demoData from "../data/demo_data.json";
import { useNavigate } from "react-router-dom";
import { getRiskLevel, getRiskColor } from "../utils/risk";

export default function ScanHistory() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");

  const handleClearFilters = () => {
    setSearchTerm("");
    setRiskFilter("All");
  };

  const filteredData = demoData.filter((record) => {
    const matchesSearch = record.domain.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesRisk = true;
    if (riskFilter !== "All") {
      matchesRisk = getRiskLevel(record.risk_score) === riskFilter;
    }

    return matchesSearch && matchesRisk;
  });

  return (
    <>
      <Header
        title="Scan History"
        subtitle="Search and review earlier detection records."
      />

      <section className="filter-row">
        <input
          type="text"
          className="search-input"
          placeholder="Search by domain"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select 
          className="filter-select" 
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
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

      <div style={{ fontSize: "13px", marginBottom: "10px" }}>
        Showing {filteredData.length} detection records
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
            {filteredData.length > 0 ? (
              filteredData.map((record) => (
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
                      onClick={() => navigate(`/review/${record.id}`)}
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
