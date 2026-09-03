import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";

export default function DataUpload() {
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

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
    setError("");
    const isCSV = file.name.endsWith(".csv") || file.type === "text/csv";
    const isJSON =
      file.name.endsWith(".json") || file.type === "application/json";

    if (!isCSV && !isJSON) {
      setError("Unsupported file format. Please upload a .csv or .json file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        let parsed = [];

        if (isCSV) {
          parsed = parseCSV(text);
        } else {
          parsed = parseJSON(text);
        }

        if (parsed.length === 0) {
          setError("No valid URL records found in this file.");
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
      } catch (err) {
        setError(`Failed to parse file: ${err.message}`);
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

    let headerIndex = -1;
    const headerRow = lines[0].split(",").map((col) =>
      col
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase(),
    );

    // Check for 'url' or 'domain' header
    headerIndex = headerRow.findIndex(
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
        if (clean) {
          urls.push({
            id: idx + 1,
            original: rawUrl,
            domain: clean,
            length: clean.length,
            valid: isValidDomain(clean),
          });
        }
      }
    });

    return urls;
  };

  const parseJSON = (content) => {
    const data = JSON.parse(content);
    let list = [];

    if (Array.isArray(data)) {
      list = data;
    } else if (data && typeof data === "object") {
      const possibleArray = Object.values(data).find((val) =>
        Array.isArray(val),
      );
      if (possibleArray) {
        list = possibleArray;
      } else {
        throw new Error("JSON must contain an array of strings or objects.");
      }
    }

    const urls = [];
    list.forEach((item, idx) => {
      let rawUrl = "";
      if (typeof item === "string") {
        rawUrl = item;
      } else if (item && typeof item === "object") {
        rawUrl =
          item.url ||
          item.domain ||
          item.URL ||
          item.Domain ||
          Object.values(item)[0] ||
          "";
      }

      if (rawUrl && typeof rawUrl === "string") {
        const clean = cleanUrl(rawUrl);
        if (clean) {
          urls.push({
            id: idx + 1,
            original: rawUrl,
            domain: clean,
            length: clean.length,
            valid: isValidDomain(clean),
          });
        }
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

  const isValidDomain = (domain) => {
    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain);
  };

  const loadSampleCSV = () => {
    const sample = `url\npaypal-account-update.info\nsafe-banking-verify.com\napple-id-recovery.net\nlegitimate-site.org\nmicro-secure-login.xyz`;
    const parsed = parseCSV(sample);
    setFileName("sample_domains.csv");
    setFileSize("145 B");
    setRecords(parsed);
    setFileData({
      name: "sample_domains.csv",
      totalCount: parsed.length,
      appliedCount: parsed.length,
      type: "CSV",
    });
    setError("");
  };

  const loadSampleJSON = () => {
    const sample = JSON.stringify(
      [
        { url: "chase-auth-service.com" },
        { url: "github-enterprise-login.net" },
        { url: "amazon-prime-alert.xyz" },
        { url: "google-workspace-verify.info" },
        { url: "bank-portal-security.org" },
      ],
      null,
      2,
    );
    const parsed = parseJSON(sample);
    setFileName("sample_feed.json");
    setFileSize("210 B");
    setRecords(parsed);
    setFileData({
      name: "sample_feed.json",
      totalCount: parsed.length,
      appliedCount: parsed.length,
      type: "JSON",
    });
    setError("");
  };

  const handleScanRecord = (domain) => {
    navigate('/scan', { state: { domain } });
  };

  const handleReset = () => {
    setFileData(null);
    setFileName("");
    setFileSize("");
    setRecords([]);
    setError("");
    setSearchTerm("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      r.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.original.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <>
      <Header
        title="Data upload"
        subtitle="Preview another CSV or JSON dataset in the dashboard without sending it anywhere."
      />

      {error && <p style={{ color: "red", marginBottom: "15px" }}>{error}</p>}

      {!fileData ? (
        <>
          <section className="scan-box">
            <h2>Choose a CSV or JSON file</h2>
            <p>
              Files are parsed locally in your browser. This demo accepts up to
              1,000 URL records at a time.
            </p>
            <p>
              <strong>CSV:</strong> 1st row header "url", then one URL per line.
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
          </section>
        </>
      ) : (
        <>
          <section className="state-boxes" style={{ marginBottom: "20px" }}>
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
          </section>

          <section className="filter-row">
            <input
              type="text"
              placeholder="Search loaded domains..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: "250px", padding: "5px" }}
            />
            <span style={{ fontSize: "14px", lineHeight: "30px" }}>
              Showing {filteredRecords.length} of {records.length} records
            </span>
          </section>

          <section
            className="history-box"
            style={{ overflowX: "auto", padding: "10px", borderTop: "none" }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid black" }}>
                  <th style={{ padding: "8px" }}>#</th>
                  <th style={{ padding: "8px" }}>Domain / URL</th>
                  <th style={{ padding: "8px" }}>Original Value</th>
                  <th style={{ padding: "8px" }}>Length</th>
                  <th style={{ padding: "8px" }}>Validation</th>
                  <th style={{ padding: "8px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px dotted #ccc" }}>
                    <td style={{ padding: "8px" }}>{item.id}</td>
                    <td style={{ padding: "8px", fontWeight: "bold" }}>
                      {item.domain}
                    </td>
                    <td style={{ padding: "8px" }}>{item.original}</td>
                    <td style={{ padding: "8px" }}>{item.length} chars</td>
                    <td
                      style={{
                        padding: "8px",
                        color: item.valid ? "green" : "red",
                      }}
                    >
                      {item.valid ? "Valid Format" : "Needs Review"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <button
                        className="btn-manual-scan"
                        onClick={() => handleScanRecord(item.domain)}
                        style={{
                          padding: "2px 8px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        INSPECT
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
