import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import { fetchScans, createScan, uploadScanFile } from "../Services/api";
import Button from "../components/Button";
import ApiState from "../components/ApiState";

export default function AnalystWorkspace() {
  const [personalRecords, setPersonalRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState(null);

  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "my_records");
  // Data Upload State
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [sortOption, setSortOption] = useState("Highest risk first");

  const clearFilters = () => {
    setSearchTerm("");
    setRiskFilter("All");
    setStatusFilter("All");
    setSourceFilter("All");
    setSortOption("Highest risk first");
  };

  // Manual Scan State
  const [domain, setDomain] = useState(location.state?.domain || "");
  const [scanError, setScanError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadPersonalRecords = async (showLoading = true) => {
    if (showLoading) setRecordsLoading(true);
    setRecordsError(null);
    try {
      const res = await fetchScans("personal");
      setPersonalRecords(res.records || []);
    } catch (err) {
      setRecordsError(err.message);
    } finally {
      setRecordsLoading(false);
    }
  };

  useEffect(() => {
    loadPersonalRecords(false);
  }, []);

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadError("");
      setUploading(true);
      try {
        const res = await uploadScanFile(file);
        setFileName(file.name);
        setFileSize(formatBytes(file.size));
        setFileData({
          name: res.filename || file.name,
          totalCount: res.accepted_count + res.rejected_count,
          appliedCount: res.accepted_count,
          errors: res.errors || [],
        });
        await loadPersonalRecords();
        setActiveTab("my_records");
      } catch (err) {
        setUploadError(err.message || "Failed to upload file");
      } finally {
        setUploading(false);
      }
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  const handleReset = () => {
    setFileData(null);
    setFileName("");
    setFileSize("");
    setUploadError("");
    setSearchTerm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    setScanError("");
    let input = domain;
    if (!input) return setScanError("Please enter a domain name.");
    if (/\s/.test(input))
      return setScanError("The domain cannot contain spaces.");
    input = input
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      .split("?")[0];
    if (/[^a-zA-Z0-9.-]/.test(input))
      return setScanError(
        "Invalid characters. A domain normally contains letters, numbers, dots, and hyphens.",
      );
    if (!/\.[a-zA-Z]{2,}$/.test(input))
      return setScanError("Please enter a complete domain such as google.com.");
    setDomain(input);
    setLoading(true);

    try {
      const res = await createScan(input);
      await loadPersonalRecords();
      navigate(`/review/personal/${res.id}`);
    } catch (err) {
      setScanError(err.message || "Failed to scan domain.");
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = personalRecords.filter((r) => {
    const matchesSearch =
      r.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.original &&
        r.original.toLowerCase().includes(searchTerm.toLowerCase())) ||
      r.id.toString().includes(searchTerm);

    let matchesRisk = true;
    if (riskFilter === "High") {
      matchesRisk = r.prediction?.toLowerCase() === "high" || r.risk_score >= 75;
    } else if (riskFilter === "Medium") {
      matchesRisk = r.prediction?.toLowerCase() === "medium" || (r.risk_score >= 40 && r.risk_score < 75);
    } else if (riskFilter === "Low") {
      matchesRisk = r.prediction?.toLowerCase() === "low" || (r.risk_score !== undefined && r.risk_score < 40);
    }

    let matchesStatus = true;
    if (statusFilter === "Completed") {
      matchesStatus = r.review_status === "Completed";
    } else if (statusFilter === "Pending") {
      matchesStatus = r.review_status === "Pending" || !r.review_status;
    }

    let matchesSource = true;
    if (sourceFilter === "Manual") {
      matchesSource = r.source === "manual";
    } else if (sourceFilter === "Import") {
      matchesSource = r.source !== "manual";
    }

    return matchesSearch && matchesRisk && matchesStatus && matchesSource;
  });

  const sortedRecords = [...filteredRecords];
  if (sortOption === "Highest risk first") {
    sortedRecords.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
  } else if (sortOption === "Lowest risk first") {
    sortedRecords.sort((a, b) => (a.risk_score || 0) - (b.risk_score || 0));
  } else if (sortOption === "Newest first") {
    sortedRecords.sort((a, b) => new Date(b.scan_time || 0) - new Date(a.scan_time || 0));
  } else if (sortOption === "Oldest first") {
    sortedRecords.sort((a, b) => new Date(a.scan_time || 0) - new Date(b.scan_time || 0));
  }

  return (
    <>
      <Header
        title="Analyst Workspace"
        subtitle="Domains you search manually or import from a file are stored here. They never change the automated live-dashboard totals."
      />

      <div className="metrics-row">
        <div className="metric-card">
          <h3>My records</h3>
          <div className="metric-sub">{personalRecords.length}</div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            Manual + imported
          </p>
        </div>
        <div className="metric-card">
          <h3>Manual searches</h3>
          <div className="metric-sub">
            {personalRecords.filter((r) => r.source === "manual").length}
          </div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            Submitted one at a time
          </p>
        </div>
        <div className="metric-card">
          <h3>Imported records</h3>
          <div className="metric-sub">
            {personalRecords.filter((r) => r.source !== "manual").length}
          </div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            {fileName || "No file imported"}
          </p>
        </div>
        <div className="metric-card">
          <h3>Awaiting review</h3>
          <div className="metric-sub">
            {
              personalRecords.filter((r) => r.review_status === "Pending")
                .length
            }
          </div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            Analyst decisions needed
          </p>
        </div>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <Button
          variant="default"
          className={activeTab === "my_records" ? "active" : ""}
          onClick={() => setActiveTab("my_records")}
        >
          My records
        </Button>
        <Button
          variant="default"
          className={activeTab === "manual_search" ? "active" : ""}
          onClick={() => setActiveTab("manual_search")}
        >
          Manual search
        </Button>
        <Button
          variant="default"
          className={activeTab === "import_csv" ? "active" : ""}
          onClick={() => setActiveTab("import_csv")}
        >
          Import CSV / JSON
        </Button>
      </div>

      {activeTab === "my_records" && (
        <div className="scan-box" style={{ borderTop: "none" }}>
          <h2>My analysis records</h2>
          <p>
            Only domains created by your manual searches or file imports appear
            in this table.
          </p>

          <ApiState
            loading={recordsLoading}
            error={recordsError}
            onRetry={loadPersonalRecords}
          />

          {!recordsLoading && !recordsError && (
            <>
              <div className="filter-row" style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold" }}>
                    Search records
                  </label>
                  <input
                    type="text"
                    placeholder="Domain, URL or record ID"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: "250px", padding: "5px" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold" }}>
                    Risk level
                  </label>
                  <select 
                    style={{ width: "150px", padding: "5px" }}
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                  >
                    <option value="All">All risk levels</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold" }}>
                    Review status
                  </label>
                  <select 
                    style={{ width: "150px", padding: "5px" }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="All">All review statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold" }}>
                    Record source
                  </label>
                  <select 
                    style={{ width: "150px", padding: "5px" }}
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                  >
                    <option value="All">All sources</option>
                    <option value="Manual">Manual search</option>
                    <option value="Import">File import</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", marginBottom: "2px" }}>
                  <Button variant="outline" size="small" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontSize: "14px" }}>
                  <strong>{filteredRecords.length}</strong> of{" "}
                  {personalRecords.length} records
                </span>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span style={{ fontSize: "12px" }}>Sort by</span>
                  <select 
                    style={{ padding: "5px" }} 
                    value={sortOption} 
                    onChange={(e) => setSortOption(e.target.value)}
                  >
                    <option value="Highest risk first">Highest risk first</option>
                    <option value="Lowest risk first">Lowest risk first</option>
                    <option value="Newest first">Newest first</option>
                    <option value="Oldest first">Oldest first</option>
                  </select>
                </div>
              </div>

              <table className="app-table">
                <thead>
                  <tr>
                    <th>Domain / record</th>
                    <th>Prediction</th>
                    <th>Risk score</th>
                    <th>Review status</th>
                    <th>Recorded</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: "bold" }}>{item.domain}</div>
                        <div style={{ fontSize: "12px", color: "gray" }}>
                          {item.source === "manual"
                            ? "MANUAL"
                            : `IMPORT - ${item.original}`}
                        </div>
                      </td>
                      <td
                        style={{
                          color: item.risk_score >= 75 ? "red" : item.risk_score >= 40 ? "orange" : "green",
                        }}
                      >
                        {item.prediction}
                      </td>
                      <td
                        style={{
                          color: item.risk_score >= 75 ? "red" : item.risk_score >= 40 ? "orange" : "green",
                        }}
                      >
                        {item.risk_score}
                      </td>
                      <td
                        style={{
                          color:
                            item.review_status === "Completed"
                              ? "green"
                              : "#d97706",
                        }}
                      >
                        {item.review_status || "Pending review"}
                      </td>
                      <td style={{ color: "gray", fontSize: "12px" }}>
                        {item.scan_time
                          ? new Date(item.scan_time).toLocaleString()
                          : "Unknown"}
                      </td>
                      <td>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() =>
                            navigate(`/review/personal/${item.id}`)
                          }
                        >
                          Open &gt;
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {sortedRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        style={{ padding: "20px", textAlign: "center", color: "gray" }}
                      >
                        No records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {activeTab === "manual_search" && (
        <div className="scan-box" style={{ borderTop: "none" }}>
          <h2>Enter a domain</h2>
          <form className="scan-input-group" onSubmit={handleScanSubmit}>
            <label htmlFor="domain-input">Domain name or URL</label>
            <div className="scan-input-row">
              <input
                id="domain-input"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Enter a domain, for example: google.com"
                disabled={loading}
              />
              <Button
                type="submit"
                variant="outline"
                size="large"
                disabled={loading}
              >
                {loading ? "SCANNING..." : "SCAN DOMAIN"}
              </Button>
            </div>
            {scanError && (
              <p style={{ color: "red", marginTop: "10px" }}>{scanError}</p>
            )}
          </form>

          {loading && (
            <div className="state-box" style={{ marginTop: "20px" }}>
              <strong>LOADING STATE</strong>
              <p>Scanning domain...</p>
              <p>Extracting lexical, WHOIS, SSL, DNS, and hosting features.</p>
            </div>
          )}

          <div className="steps-box" style={{ marginTop: "20px" }}>
            <ol>
              <li>Validate the domain</li>
              <li>Request analysis from backend</li>
              <li>Extract detailed domain features</li>
              <li>Calculate the 0-100 risk score</li>
              <li>Open the Scan Result page</li>
            </ol>
          </div>
        </div>
      )}

      {activeTab === "import_csv" && (
        <div className="scan-box" style={{ borderTop: "none" }}>
          {uploadError && (
            <p style={{ color: "red", marginBottom: "15px" }}>{uploadError}</p>
          )}
          {!fileData ? (
            <>
              <h2>Choose a CSV or JSON file</h2>
              <p>
                Files are uploaded to the backend. This demo accepts up to 1,000
                URL records at a time.
              </p>
              <p>
                <strong>CSV:</strong> 1st row header "url", then one URL per
                line.
                <br />
                <strong>JSON:</strong> Array of objects containing a "url"
                property.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={handleFileInputChange}
                style={{ display: "none" }}
              />
              <Button
                variant="outline"
                onClick={handleBrowseClick}
                style={{ marginTop: "10px" }}
                disabled={uploading}
              >
                {uploading ? "UPLOADING..." : "BROWSE FILES"}
              </Button>
            </>
          ) : (
            <div className="state-box">
              <strong>{fileName}</strong>
              <p>
                Size: {fileSize} | Accepted: {fileData.appliedCount} /{" "}
                {fileData.totalCount}
              </p>
              {fileData.errors && fileData.errors.length > 0 && (
                <div style={{ color: "red", marginTop: "10px" }}>
                  <strong>Errors:</strong>
                  <ul>
                    {fileData.errors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                variant="outline"
                onClick={handleReset}
                style={{ marginTop: "10px" }}
              >
                UPLOAD DIFFERENT FILE
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
