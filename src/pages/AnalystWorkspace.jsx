import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "../components/Header";
import { useScanData } from "../context/ScanDataContext";

export default function AnalystWorkspace() {
  const { personalRecords: demoData } = useScanData();
  const [activeTab, setActiveTab] = useState("my_records");

  // Data Upload State
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [records, setRecords] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef(null);

  // Manual Scan State
  const location = useLocation();
  const [domain, setDomain] = useState(location.state?.domain || "");
  const [scanError, setScanError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- Data Upload Logic ---
  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  const processFile = (file) => {
    setUploadError("");
    const isCSV = file.name.endsWith(".csv") || file.type === "text/csv";
    const isJSON =
      file.name.endsWith(".json") || file.type === "application/json";

    if (!isCSV && !isJSON) {
      setUploadError(
        "Unsupported file format. Please upload a .csv or .json file.",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        let parsed = [];
        if (isCSV) parsed = parseCSV(text);
        else parsed = parseJSON(text);

        if (parsed.length === 0) {
          setUploadError("No valid URL records found in this file.");
          return;
        }

        const maxRecords = parsed.slice(0, 1000);
        setFileName(file.name);
        setFileSize(formatBytes(file.size));
        setRecords(maxRecords);
        setFileData({
          name: file.name,
          totalCount: parsed.length,
          appliedCount: maxRecords.length,
          type: isCSV ? "CSV" : "JSON",
        });
        setActiveTab("my_records"); // Switch to records view
      } catch (err) {
        setUploadError(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const parseCSV = (content) => {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const headerRow = lines[0].split(",").map((col) =>
      col
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase(),
    );
    const headerIndex = headerRow.findIndex(
      (col) => col === "url" || col === "domain" || col.includes("url"),
    );
    const dataRows = headerIndex !== -1 ? lines.slice(1) : lines;
    const colToUse = headerIndex !== -1 ? headerIndex : 0;
    const urls = [];
    dataRows.forEach((row, idx) => {
      const cols = row
        .split(",")
        .map((c) => c.trim().replace(/^["']|["']$/g, ""));
      const rawUrl = cols[colToUse];
      if (rawUrl) {
        const clean = cleanUrl(rawUrl);
        if (clean)
          urls.push({
            id: idx + 1,
            original: rawUrl,
            domain: clean,
            length: clean.length,
            valid: isValidDomain(clean),
          });
      }
    });
    return urls;
  };

  const parseJSON = (content) => {
    const data = JSON.parse(content);
    let list = Array.isArray(data) ? data : [];
    if (!Array.isArray(data) && data && typeof data === "object") {
      const possibleArray = Object.values(data).find((val) =>
        Array.isArray(val),
      );
      if (possibleArray) list = possibleArray;
      else throw new Error("JSON must contain an array of strings or objects.");
    }
    const urls = [];
    list.forEach((item, idx) => {
      let rawUrl =
        typeof item === "string"
          ? item
          : item && typeof item === "object"
            ? item.url ||
              item.domain ||
              item.URL ||
              item.Domain ||
              Object.values(item)[0] ||
              ""
            : "";
      if (rawUrl && typeof rawUrl === "string") {
        const clean = cleanUrl(rawUrl);
        if (clean)
          urls.push({
            id: idx + 1,
            original: rawUrl,
            domain: clean,
            length: clean.length,
            valid: isValidDomain(clean),
          });
      }
    });
    return urls;
  };

  const cleanUrl = (str) => {
    let s = str.trim();
    s = s.replace(/^https?:\/\//i, "");
    s = s.split("/")[0].split("?")[0];
    return s;
  };

  const isValidDomain = (domain) =>
    /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain);

  const handleScanRecord = (domain) => navigate("/scan", { state: { domain } });

  const handleReset = () => {
    setFileData(null);
    setFileName("");
    setFileSize("");
    setRecords([]);
    setUploadError("");
    setSearchTerm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Manual Scan Logic ---
  const handleScanSubmit = (e) => {
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
    setTimeout(() => {
      const matchedRecord = demoData.find(
        (record) => record.domain.toLowerCase() === input.toLowerCase(),
      );
      setLoading(false);
      if (matchedRecord) navigate(`/review/${matchedRecord.id}`);
      else setScanError("This domain is not available in the data.");
    }, 1500);
  };

  const filteredRecords = records.filter(
    (r) =>
      r.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.original.toLowerCase().includes(searchTerm.toLowerCase()),
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
          <div className="metric-sub">{records.length + (domain ? 1 : 0)}</div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            Manual + imported
          </p>
        </div>
        <div className="metric-card">
          <h3>Manual searches</h3>
          <div className="metric-sub">{domain ? 1 : 0}</div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            Submitted one at a time
          </p>
        </div>
        <div className="metric-card">
          <h3>Imported records</h3>
          <div className="metric-sub">{records.length}</div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            {fileName || "No file imported"}
          </p>
        </div>
        <div className="metric-card">
          <h3>Awaiting review</h3>
          <div className="metric-sub">{records.length + (domain ? 1 : 0)}</div>
          <p style={{ fontSize: "12px", color: "#64748b" }}>
            Analyst decisions needed
          </p>
        </div>
      </div>

      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <button
          onClick={() => setActiveTab("my_records")}
          className="btn-manual-scan"
          style={{
            fontWeight: activeTab === "my_records" ? "bold" : "normal",
            backgroundColor: activeTab === "my_records" ? "#e2e8f0" : "white",
          }}
        >
          My records
        </button>
        <button
          onClick={() => setActiveTab("manual_search")}
          className="btn-manual-scan"
          style={{
            fontWeight: activeTab === "manual_search" ? "bold" : "normal",
            backgroundColor:
              activeTab === "manual_search" ? "#e2e8f0" : "white",
          }}
        >
          Manual search
        </button>
        <button
          onClick={() => setActiveTab("import_csv")}
          className="btn-manual-scan"
          style={{
            fontWeight: activeTab === "import_csv" ? "bold" : "normal",
            backgroundColor: activeTab === "import_csv" ? "#e2e8f0" : "white",
          }}
        >
          Import CSV / JSON
        </button>
      </div>

      {activeTab === "my_records" && (
        <div className="scan-box" style={{ borderTop: "none" }}>
          <h2>My analysis records</h2>
          <p>
            Only domains created by your manual searches or file imports appear
            in this table.
          </p>

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
              <select style={{ width: "150px", padding: "5px" }}>
                <option>All risk levels</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold" }}>
                Review status
              </label>
              <select style={{ width: "150px", padding: "5px" }}>
                <option>All review statuses</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold" }}>
                Record source
              </label>
              <select style={{ width: "150px", padding: "5px" }}>
                <option>All sources</option>
              </select>
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
              <strong>{filteredRecords.length}</strong> of {records.length}{" "}
              records
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12px" }}>Sort by</span>
              <select style={{ padding: "5px" }}>
                <option>Highest score first</option>
              </select>
            </div>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid black" }}>
                <th style={{ padding: "8px" }}>Domain / record</th>
                <th style={{ padding: "8px" }}>Risk level</th>
                <th style={{ padding: "8px" }}>Review status</th>
                <th style={{ padding: "8px" }}>Recorded</th>
                <th style={{ padding: "8px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px dotted #ccc" }}>
                  <td style={{ padding: "8px" }}>
                    <div style={{ fontWeight: "bold" }}>{item.domain}</div>
                    <div style={{ fontSize: "12px", color: "gray" }}>
                      IMPORT - {item.original}
                    </div>
                  </td>
                  <td style={{ padding: "8px", color: "red" }}>
                    Critical - 86
                  </td>
                  <td style={{ padding: "8px", color: "#d97706" }}>
                    Pending review
                  </td>
                  <td
                    style={{ padding: "8px", color: "gray", fontSize: "12px" }}
                  >
                    08 Sept, 05:06 pm
                  </td>
                  <td style={{ padding: "8px" }}>
                    <button
                      onClick={() => handleScanRecord(item.domain)}
                      style={{
                        cursor: "pointer",
                        background: "none",
                        border: "none",
                        fontWeight: "bold",
                      }}
                    >
                      Open &gt;
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    style={{ padding: "20px", textAlign: "center" }}
                  >
                    No records to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
              <button
                type="submit"
                className="btn-scan"
                disabled={loading}
                style={{
                  textDecoration: "none",
                  display: "inline-block",
                  textAlign: "center",
                  color: "black",
                  padding: "10px 24px",
                  boxSizing: "border-box",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  border: "1px solid black",
                  background: "white",
                }}
              >
                {loading ? "SCANNING..." : "SCAN DOMAIN"}
              </button>
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
                Files are parsed locally in your browser. This demo accepts up
                to 1,000 URL records at a time.
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
              <button
                type="button"
                className="btn-manual-scan"
                onClick={handleBrowseClick}
                style={{
                  cursor: "pointer",
                  display: "inline-block",
                  marginTop: "10px",
                }}
              >
                BROWSE FILES
              </button>
            </>
          ) : (
            <div className="state-box">
              <strong>{fileName}</strong>
              <p>
                Type: {fileData.type} | Size: {fileSize} | Records parsed:{" "}
                {records.length}
              </p>
              <button
                className="btn-manual-scan"
                onClick={handleReset}
                style={{
                  cursor: "pointer",
                  display: "inline-block",
                  marginTop: "10px",
                }}
              >
                UPLOAD DIFFERENT FILE
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
