import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import {
  fetchScans,
  createScan,
  uploadScanFile,
  MAX_IMPORT_RECORDS,
} from "../Services/Client";
import Button from "../components/Button";
import ApiState from "../components/ApiState";

export default function AnalystWorkspace() {
  const [personalRecords, setPersonalRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState(null);

  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.state?.activeTab || "my_records",
  );
  // Data Upload State
  const [fileData, setFileData] = useState(null);
  const [lastImport, setLastImport] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOption, setSortOption] = useState("Highest risk first");
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, riskFilter, statusFilter, sortOption]);

  const clearFilters = () => {
    setSearchTerm("");
    setRiskFilter("All");
    setStatusFilter("All");
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
    const input = e.target;
    const file = input.files?.[0];
    if (!file || uploading) return;

    setUploadError("");
    setFileData(null);
    setFileName(file.name);
    setFileSize(formatBytes(file.size));
    setUploading(true);
    try {
      const res = await uploadScanFile(file);
      setFileName(res.filename || file.name);
      setFileData({
        totalCount: res.accepted_count + res.rejected_count,
        acceptedCount: res.accepted_count,
        rejectedCount: res.rejected_count,
        errors: res.errors || [],
      });
      setLastImport({
        filename: res.filename || file.name,
        acceptedCount: res.accepted_count,
      });
      await loadPersonalRecords();
    } catch (err) {
      setUploadError(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
      // Allow selecting the same file again after an error or a completed import.
      input.value = "";
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleViewImportedRecords = () => {
    clearFilters();
    setSortOption("Newest first");
    setCurrentPage(1);
    setActiveTab("my_records");
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
    const cleanSearch = searchTerm.trim().toLowerCase();

    const domainText = (r.domain || "").toLowerCase();
    const originalText = (r.original || "").toLowerCase();
    const idText = (r.id || "").toString().toLowerCase();

    const matchesSearch =
      domainText.includes(cleanSearch) ||
      originalText.includes(cleanSearch) ||
      idText.includes(cleanSearch);

    let matchesRisk = true;
    if (riskFilter === "High") {
      matchesRisk =
        r.prediction?.toLowerCase() === "high" || r.risk_score >= 75;
    } else if (riskFilter === "Medium") {
      matchesRisk =
        r.prediction?.toLowerCase() === "medium" ||
        (r.risk_score >= 40 && r.risk_score < 75);
    } else if (riskFilter === "Low") {
      matchesRisk =
        r.prediction?.toLowerCase() === "low" ||
        (r.risk_score !== undefined && r.risk_score < 40);
    }

    let matchesStatus = true;
    if (statusFilter === "Completed") {
      matchesStatus = r.review_status === "Completed";
    } else if (statusFilter === "Pending") {
      matchesStatus = r.review_status === "Pending" || !r.review_status;
    }

    return matchesSearch && matchesRisk && matchesStatus;
  });

  const sortedRecords = [...filteredRecords];
  if (sortOption === "Highest risk first") {
    sortedRecords.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
  } else if (sortOption === "Lowest risk first") {
    sortedRecords.sort((a, b) => (a.risk_score || 0) - (b.risk_score || 0));
  } else if (sortOption === "Newest first") {
    sortedRecords.sort(
      (a, b) => new Date(b.scan_time || 0) - new Date(a.scan_time || 0),
    );
  } else if (sortOption === "Oldest first") {
    sortedRecords.sort(
      (a, b) => new Date(a.scan_time || 0) - new Date(b.scan_time || 0),
    );
  }

  const totalPages = Math.ceil(sortedRecords.length / recordsPerPage) || 1;
  const currentRecords = sortedRecords.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage,
  );

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
          <h3>Completed reviews</h3>
          <div className="metric-sub">
            {personalRecords.filter((r) => r.review_status === "Completed").length}
          </div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            Analyst decisions saved
          </p>
        </div>
        <div className="metric-card">
          <h3>Last file import</h3>
          <div className="metric-sub">{lastImport?.acceptedCount ?? "—"}</div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            {lastImport
              ? `${lastImport.filename} · records accepted`
              : "No file imported this session"}
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    marginBottom: "2px",
                  }}
                >
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
                    <option value="Highest risk first">
                      Highest risk first
                    </option>
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
                  {currentRecords.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: "bold" }}>{item.domain}</div>
                        <div style={{ fontSize: "12px", color: "gray" }}>
                          {item.original && item.original !== item.domain
                            ? item.original
                            : "PERSONAL SCAN"}
                        </div>
                      </td>
                      <td
                        style={{
                          color:
                            item.prediction?.toLowerCase() === "phishing"
                              ? "red"
                              : item.prediction?.toLowerCase() === "legitimate"
                                ? "green"
                                : "inherit",
                        }}
                      >
                        {item.prediction}
                      </td>
                      <td
                        style={{
                          color:
                            item.risk_score >= 75
                              ? "red"
                              : item.risk_score >= 40
                                ? "orange"
                                : "green",
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
                        style={{
                          padding: "20px",
                          textAlign: "center",
                          color: "gray",
                        }}
                      >
                        No records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {sortedRecords.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "15px",
                  }}
                >
                  <span style={{ fontSize: "14px", color: "gray" }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="small"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
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
              <p>Calculating demo lexical and risk features.</p>
            </div>
          )}

          <div className="steps-box" style={{ marginTop: "20px" }}>
            <h4 style={{ marginBottom: "10px", marginTop: "0" }}>
              Supported Input Formats:
            </h4>
            <ul>
              <li style={{ marginBottom: "5px" }}>
                <strong>Standard domains:</strong> <code>example.com</code>
              </li>
              <li style={{ marginBottom: "5px" }}>
                <strong>Subdomains:</strong> <code>login.example.com</code>
              </li>
              <li>
                <strong>Full URLs:</strong>{" "}
                <code>https://www.example.com/path</code> (Base domain extracted
                automatically)
              </li>
            </ul>
            <h4 style={{ marginTop: "15px", marginBottom: "10px" }}>
              Formatting Rules:
            </h4>
            <ul>
              <li style={{ marginBottom: "5px" }}>
                Must include a valid top-level domain (e.g., <code>.com</code>,{" "}
                <code>.org</code>)
              </li>
              <li style={{ marginBottom: "5px" }}>
                No spaces or special characters allowed (except hyphens)
              </li>
              <li>
                Paths and query parameters are automatically removed before
                scanning
              </li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === "import_csv" && (
        <div
          className="scan-box"
          style={{ borderTop: "none" }}
          aria-busy={uploading}
        >
          <h2>Import a CSV or JSON file</h2>
          <p>
            Upload up to {MAX_IMPORT_RECORDS.toLocaleString()} domain or URL
            records in a UTF-8 file, 2 MB or smaller. Valid records are scanned
            and saved to My records.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            aria-label="Choose a CSV or JSON file"
            onChange={handleFileInputChange}
            disabled={uploading}
            style={{ display: "none" }}
          />
          {uploadError && (
            <p role="alert" style={{ color: "#b91c1c", marginBottom: "15px" }}>
              {uploadError}
            </p>
          )}
          {!fileData ? (
            <>
              <Button
                variant="outline"
                onClick={handleBrowseClick}
                style={{ marginTop: "10px" }}
                disabled={uploading}
              >
                {uploading ? "SCANNING FILE..." : "BROWSE FILES"}
              </Button>
              {uploading && (
                <div
                  role="status"
                  className="state-box"
                  style={{ marginTop: "20px" }}
                >
                  <strong>{fileName}</strong>
                  <p>Size: {fileSize}</p>
                  <p>
                    Uploading and scanning the records. Large imports may take
                    several minutes; keep this page open until the results appear.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="state-box">
              <div role="status">
                <strong>{fileName}</strong>
                <p>
                  Size: {fileSize} | Records processed: {fileData.totalCount}
                </p>
                <p>
                  Accepted: {fileData.acceptedCount} | Rejected:{" "}
                  {fileData.rejectedCount}
                </p>
                <p>
                  {fileData.totalCount === 0
                    ? "No records were found. Add domains or URLs and try again."
                    : fileData.acceptedCount === 0
                      ? "No records were imported. Correct the rejected records and try again."
                      : `${fileData.acceptedCount} ${fileData.acceptedCount === 1 ? "record was" : "records were"} scanned and saved to My records.`}
                </p>
              </div>
              {fileData.errors.length > 0 && (
                <details open style={{ color: "#b91c1c", marginTop: "10px" }}>
                  <summary>Rejected records ({fileData.rejectedCount})</summary>
                  <ul style={{ maxHeight: "240px", overflowY: "auto" }}>
                    {fileData.errors.map((err, idx) => (
                      <li key={idx}>
                        {typeof err === "string"
                          ? err
                          : `Row ${err.row}: ${err.message}`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "15px",
                }}
              >
                {fileData.acceptedCount > 0 && (
                  <Button
                    variant="primary"
                    onClick={handleViewImportedRecords}
                    disabled={uploading}
                  >
                    VIEW IMPORTED RECORDS
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={uploading}
                >
                  UPLOAD ANOTHER FILE
                </Button>
              </div>
            </div>
          )}

          <div className="steps-box" style={{ marginTop: "20px" }}>
            <h4 style={{ marginBottom: "10px", marginTop: "0" }}>
              Supported input formats
            </h4>
            <ul>
              <li style={{ marginBottom: "5px" }}>
                <strong>CSV:</strong> Use a <code>url</code> or <code>domain</code>{" "}
                column header, or put one value per line without a header.
              </li>
              <li>
                <strong>JSON:</strong> Use an array of objects with a{" "}
                <code>"url"</code> or <code>"domain"</code> property, or an array
                of strings. If both fields are present, <code>url</code> is used.
              </li>
            </ul>
            <p><strong>CSV example</strong></p>
            <pre style={{ overflowX: "auto" }}>
              <code>{"url\nhttps://example.com/login\nexample.org"}</code>
            </pre>
            <p><strong>JSON example</strong></p>
            <pre style={{ overflowX: "auto" }}>
              <code>{'[\n  { "url": "https://example.com/login" },\n  { "domain": "example.org" }\n]'}</code>
            </pre>
            <h4 style={{ marginTop: "15px", marginBottom: "10px" }}>
              Formatting rules
            </h4>
            <ul>
              <li style={{ marginBottom: "5px" }}>
                Use complete domains such as <code>example.com</code> or
                HTTP/HTTPS URLs. Paths and query parameters are removed before
                scanning.
              </li>
              <li style={{ marginBottom: "5px" }}>
                Avoid spaces inside a domain or URL, email addresses, and port
                numbers.
              </li>
              <li>
                Use UTF-8 encoding. The limit is 2 MB and{" "}
                {MAX_IMPORT_RECORDS.toLocaleString()} records per upload.
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
