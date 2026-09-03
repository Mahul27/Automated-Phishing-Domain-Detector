import { useState } from "react";
import Header from "../components/Header";
import demoData from "../data/demo_data.json";
import { useNavigate } from "react-router-dom";

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
    if (riskFilter === "High Risk") {
      matchesRisk = record.risk_score > 50;
    } else if (riskFilter === "Low Risk") {
      matchesRisk = record.risk_score <= 50;
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
          <option value="High Risk">High Risk</option>
          <option value="Low Risk">Low Risk</option>
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
                      color: record.risk_score > 50 ? "red" : "green",
                      fontWeight: "bold",
                    }}
                  >
                    {record.risk_score}
                  </td>
                  <td
                    style={{
                      padding: "12px",
                      color: record.risk_score > 50 ? "red" : "green",
                      fontWeight: "bold",
                    }}
                  >
                    {record.prediction}
                  </td>
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
                <td colSpan="6" style={{ padding: "12px", textAlign: "center" }}>
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
