import { useCallback, useRef, useState, useEffect } from "react";
import Header from "../components/Header";
import { useParams, useNavigate } from "react-router-dom";
import { fetchScan, updateScanReview } from "../Services/Client";
import { getRiskColor } from "../utils/risk";
import Button from "../components/Button";
import ApiState from "../components/ApiState";

function scanFeatureValues(record) {
  const nested = record.features || {};

  return {
    domain_age_days: nested.domain_age_days ?? record.domain_age,
    registration_period_days:
      nested.registration_period_days ?? record.registration_period,
    domain_length: nested.domain_length ?? record.domain_length,
    num_hyphens: nested.num_hyphens ?? record.hyphens,
    num_digits: nested.num_digits ?? record.digits,
    entropy_domain: nested.entropy_domain ?? record.shannon_entropy,
    brand_keyword: nested.brand_keyword ?? record.brand_keyword,
    typosquatting_score:
      nested.typosquatting_score ?? record.typosquatting_similarity,
    ssl_certificate_age_days:
      nested.ssl_certificate_age_days ?? record.ssl_cert_age,
    tld: nested.tld ?? record.tld,
  };
}

function reviewDateText(value) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

// Plain-English descriptions of the model's input features.
const featureExplanation = {
  domain_length:
    "The length of the domain name. Unusually long names can sometimes be suspicious.",

  num_hyphens:
    "The number of hyphens in the domain name. Multiple hyphens can sometimes be a warning sign.",

  num_digits:
    "The number of digits in the domain name. Unusual use of numbers can sometimes be suspicious.",

  entropy_domain:
    "How random the domain name appears. Random-looking names may deserve closer inspection.",

  domain_age_days:
    "How long the domain has existed. Newly registered domains may deserve closer inspection.",

  registration_period_days:
    "How long the domain was registered for. A short registration period can sometimes be a warning sign.",

  brand_keyword:
    "Whether the domain contains a recognised brand name. Some phishing websites imitate trusted brands.",

  typosquatting_score:
    "How closely the domain resembles a known brand or domain. Strong similarity can indicate an attempt to imitate it.",

  ssl_certificate_age_days:
    "How long the website's security certificate has existed. Certificate age alone cannot prove whether a website is safe.",

  tld: "The domain extension, such as .com or .nz. The extension alone cannot determine whether a website is malicious.",
};

const featureTitles = {
  domain_length: "Domain length",
  num_hyphens: "Number of hyphens",
  num_digits: "Number of digits",
  entropy_domain: "Domain name randomness",
  domain_age_days: "Domain age",
  registration_period_days: "Registration period",
  brand_keyword: "Brand name presence",
  typosquatting_score: "Brand name similarity",
  ssl_certificate_age_days: "SSL certificate age",
  tld: "Domain extension",
};

// SHAP values determine which features had the strongest influence.
// The numerical values are deliberately not displayed.
function shapExplanationItems(shapValues) {
  if (
    !shapValues ||
    typeof shapValues !== "object" ||
    Array.isArray(shapValues)
  ) {
    return [];
  }

  return Object.entries(shapValues)
    .filter(
      ([feature, value]) =>
        Object.hasOwn(featureExplanation, feature) &&
        typeof value === "number" &&
        Number.isFinite(value),
    )
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3)
    .map(([feature, value]) => ({
      feature,
      title: featureTitles[feature],
      description: featureExplanation[feature],
      direction:
        value > 0 ? "raised" : value < 0 ? "lowered" : "had little effect on",
    }));
}

export default function ScanResult() {
  const { source, id } = useParams();

  return <ScanResultDetails key={`${source}/${id}`} source={source} id={id} />;
}

function ScanResultDetails({ source, id }) {
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [reviewStatus, setReviewStatus] = useState("pending");
  const [analystNote, setAnalystNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");

  const mounted = useRef(false);
  const readRequest = useRef(null);
  const saveRequest = useRef(false);

  const searchId =
    /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))
      ? Number(id)
      : null;

  const validRoute = searchId !== null && ["personal", "live"].includes(source);

  const isPersonalRecord = record?.source
    ? record.source !== "live"
    : source === "personal";

  const historyPath = isPersonalRecord ? "/workspace" : "/queue";

  const loadRecord = useCallback(async () => {
    if (readRequest.current) return readRequest.current;

    if (!validRoute) {
      setError("This scan link is invalid. Open a record from your history.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const request = (async () => {
      try {
        const data = await fetchScan(searchId);

        if (mounted.current) {
          setRecord(data);
          setReviewStatus("pending");
          setAnalystNote(data?.note || "");
          setSaveError("");
        }
      } catch (err) {
        if (mounted.current) {
          setError(err.message || "Failed to load scan details.");
        }
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();

    readRequest.current = request;

    try {
      return await request;
    } finally {
      if (readRequest.current === request) {
        readRequest.current = null;
      }
    }
  }, [searchId, validRoute]);

  useEffect(() => {
    mounted.current = true;
    loadRecord();

    return () => {
      mounted.current = false;
    };
  }, [loadRecord]);

  if (loading || error || !record) {
    return (
      <>
        <Header
          title="Review Details"
          subtitle="Detailed analysis of the requested domain."
        />

        {validRoute ? (
          <ApiState loading={loading} error={error} onRetry={loadRecord} />
        ) : (
          <p role="alert">
            This scan link is invalid. Open a record from your history.
          </p>
        )}

        {!loading && !error && !record && (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <h2>Scan result not found.</h2>
          </div>
        )}

        <Button variant="secondary" onClick={() => navigate(historyPath)}>
          &larr; Return to Scan History
        </Button>
      </>
    );
  }

  const features = scanFeatureValues(record);
  const reviewedAt = reviewDateText(record.review_date);
  const tld = String(features.tld || "")
    .replace(/^\./, "")
    .toLowerCase();

  const shapItems =
    record.model_name === "XGBoost"
      ? shapExplanationItems(record.shap_values)
      : [];

  const hasShapExplanation = shapItems.length > 0;

  const youngDomain =
    features.domain_age_days != null && features.domain_age_days <= 30;

  const shortRegistration =
    features.registration_period_days != null &&
    features.registration_period_days <= 365;

  const highEntropy =
    features.entropy_domain != null && features.entropy_domain >= 3.5;

  const brandMatch = Number(features.brand_keyword) > 0;

  const closeBrandMatch =
    features.typosquatting_score != null &&
    features.typosquatting_score >= 0.75;

  const newCertificate =
    features.ssl_certificate_age_days != null &&
    features.ssl_certificate_age_days <= 30;

  const handleSaveDecision = async () => {
    if (saveRequest.current || !mounted.current) return;

    if (reviewStatus === "pending") {
      setSaveError(
        "Choose Confirmed phishing or Not phishing before saving your review.",
      );
      return;
    }

    saveRequest.current = true;
    setSubmitting(true);
    setSaveError("");

    const decisionText =
      reviewStatus === "phishing" ? "Confirmed Phishing" : "Confirmed Legitimate";

    try {
      await updateScanReview(searchId, {
        decision: decisionText,
        note: analystNote,
      });

      if (mounted.current) navigate(historyPath);
    } catch (err) {
      if (mounted.current) {
        setSaveError(
          err.message || "Failed to submit decision. Please try again.",
        );
      }
    } finally {
      saveRequest.current = false;

      if (mounted.current) setSubmitting(false);
    }
  };

  return (
    <>
      <Header
        title="Review Details"
        subtitle="Detailed analysis of the requested domain."
      />

      <div style={{ marginBottom: "15px" }}>
        <Button variant="secondary" onClick={() => navigate(historyPath)}>
          &larr; Back to History
        </Button>
      </div>

      {/* 1. Summary */}
      <section
        style={{
          border: "1px solid black",
          padding: "20px",
          marginBottom: "20px",
          backgroundColor: "#fff",
        }}
      >
        <h2>Summary</h2>

        <ul style={{ listStyle: "none", padding: 0, fontSize: "1.1em" }}>
          <li style={{ marginBottom: "10px" }}>
            <strong>Domain:</strong> <span>{record.domain}</span>
          </li>

          <li style={{ marginBottom: "10px" }}>
            <strong>Risk Score:</strong>{" "}
            <span
              style={{
                color: getRiskColor(record.risk_score),
                fontWeight: "bold",
              }}
            >
              {record.risk_score == null
                ? "Unknown"
                : `${record.risk_score}/100`}
            </span>
          </li>

          <li style={{ marginBottom: "10px" }}>
            <strong>Prediction:</strong>{" "}
            <span
              style={{
                color:
                  record.prediction?.toLowerCase() === "phishing"
                    ? "red"
                    : record.prediction?.toLowerCase() === "legitimate"
                      ? "green"
                      : "inherit",
                fontWeight: "bold",
              }}
            >
              {record.prediction || "Unknown"}
            </span>
          </li>

          <li style={{ marginBottom: "10px" }}>
            <strong>Analysis Method:</strong> <span>{record.model_name}</span>
          </li>

          {record.review_status === "Completed" && (
            <>
              <li style={{ marginBottom: "10px" }}>
                <strong>Review Status:</strong> {record.review_status}
              </li>

              <li style={{ marginBottom: "10px" }}>
                <strong>Analyst Decision:</strong> {record.decision}
              </li>

              {record.model_outcome && (
                <li style={{ marginBottom: "10px" }}>
                  <strong>Model Outcome:</strong> {record.model_outcome}
                  <span style={{ color: "#64748b", fontSize: "0.9em" }}>
                    {" "}(compared with the analyst's decision)
                  </span>
                </li>
              )}

              {record.reviewer && (
                <li style={{ marginBottom: "10px" }}>
                  <strong>Reviewer:</strong> {record.reviewer}
                </li>
              )}

              <li style={{ marginBottom: "10px" }}>
                <strong>Review Date:</strong> {reviewedAt}
              </li>
            </>
          )}
        </ul>
      </section>

      {/* 2. Feature and Risk Information */}
      <section
        style={{
          border: "1px solid black",
          padding: "20px",
          marginBottom: "20px",
          backgroundColor: "#fff",
        }}
      >
        <h2>Feature &amp; Risk Information</h2>
        <p>Details identified by the website analyzer:</p>

        <div
          className="table-scroll"
          role="region"
          aria-label="Scan features and risk indicators"
          tabIndex={0}
        >
          <table className="app-table" style={{ marginTop: "10px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0", textAlign: "left" }}>
                <th>Feature</th>
                <th>Detected Value</th>
                <th>Risk Indicator</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>1. Domain Age</td>
                <td>{features.domain_age_days ?? "Unknown"}</td>
                <td
                  style={{
                    color:
                      features.domain_age_days == null
                        ? "#64748b"
                        : youngDomain
                          ? "red"
                          : "green",
                    fontWeight: "bold",
                  }}
                >
                  {features.domain_age_days == null
                    ? "Unknown"
                    : youngDomain
                      ? "High Risk"
                      : "Low Risk"}
                </td>
              </tr>

              <tr>
                <td>2. Registration Period</td>
                <td>{features.registration_period_days ?? "Unknown"}</td>
                <td
                  style={{
                    color:
                      features.registration_period_days == null
                        ? "#64748b"
                        : shortRegistration
                          ? "red"
                          : "green",
                    fontWeight: "bold",
                  }}
                >
                  {features.registration_period_days == null
                    ? "Unknown"
                    : shortRegistration
                      ? "High Risk"
                      : "Low Risk"}
                </td>
              </tr>

              <tr>
                <td>3. Domain Length</td>
                <td>
                  {features.domain_length == null
                    ? "Unknown"
                    : `${features.domain_length} characters`}
                </td>
                <td
                  style={{
                    color:
                      features.domain_length == null
                        ? "#64748b"
                        : features.domain_length > 20
                          ? "orange"
                          : "green",
                    fontWeight: "bold",
                  }}
                >
                  {features.domain_length == null
                    ? "Unknown"
                    : features.domain_length > 20
                      ? "Medium Risk"
                      : "Low Risk"}
                </td>
              </tr>

              <tr>
                <td>4. Number of Hyphens</td>
                <td>
                  {features.num_hyphens == null
                    ? "Unknown"
                    : `${features.num_hyphens} hyphens`}
                </td>
                <td
                  style={{
                    color:
                      features.num_hyphens == null
                        ? "#64748b"
                        : features.num_hyphens > 1
                          ? "red"
                          : "green",
                    fontWeight: "bold",
                  }}
                >
                  {features.num_hyphens == null
                    ? "Unknown"
                    : features.num_hyphens > 1
                      ? "High Risk"
                      : "Low Risk"}
                </td>
              </tr>

              <tr>
                <td>5. Number of Digits</td>
                <td>
                  {features.num_digits == null
                    ? "Unknown"
                    : `${features.num_digits} digits`}
                </td>
                <td
                  style={{
                    color:
                      features.num_digits == null
                        ? "#64748b"
                        : features.num_digits > 0
                          ? "orange"
                          : "green",
                    fontWeight: "bold",
                  }}
                >
                  {features.num_digits == null
                    ? "Unknown"
                    : features.num_digits > 0
                      ? "Medium Risk"
                      : "Low Risk"}
                </td>
              </tr>

              <tr>
                <td>6. Domain Name Randomness</td>
                <td>{features.entropy_domain ?? "Unknown"}</td>
                <td
                  style={{
                    color:
                      features.entropy_domain == null
                        ? "#64748b"
                        : highEntropy
                          ? "red"
                          : "green",
                    fontWeight: "bold",
                  }}
                >
                  {features.entropy_domain == null
                    ? "Unknown"
                    : highEntropy
                      ? "High Risk"
                      : "Low Risk"}
                </td>
              </tr>

              <tr>
                <td>7. Brand Keyword</td>
                <td>{features.brand_keyword ?? "Unknown"}</td>
                <td
                  style={{
                    color:
                      features.brand_keyword == null
                        ? "#64748b"
                        : brandMatch
                          ? "red"
                          : "green",
                    fontWeight: "bold",
                  }}
                >
                  {features.brand_keyword == null
                    ? "Unknown"
                    : brandMatch
                      ? "High Risk"
                      : "Low Risk"}
                </td>
              </tr>

              <tr>
                <td>8. Brand Name Similarity</td>
                <td>{features.typosquatting_score ?? "Unknown"}</td>
                <td
                  style={{
                    color:
                      features.typosquatting_score == null
                        ? "#64748b"
                        : closeBrandMatch
                          ? "red"
                          : "green",
                    fontWeight: "bold",
                  }}
                >
                  {features.typosquatting_score == null
                    ? "Unknown"
                    : closeBrandMatch
                      ? "High Risk"
                      : "Low Risk"}
                </td>
              </tr>

              <tr>
                <td>9. SSL Certificate Age</td>
                <td>{features.ssl_certificate_age_days ?? "Unknown"}</td>
                <td
                  style={{
                    color:
                      features.ssl_certificate_age_days == null
                        ? "#64748b"
                        : newCertificate
                          ? "red"
                          : "green",
                    fontWeight: "bold",
                  }}
                >
                  {features.ssl_certificate_age_days == null
                    ? "Unknown"
                    : newCertificate
                      ? "High Risk"
                      : "Low Risk"}
                </td>
              </tr>

              <tr>
                <td>10. Domain Extension</td>
                <td>{tld ? `.${tld}` : "Unknown"}</td>
                <td
                  style={{
                    color: !tld
                      ? "#64748b"
                      : tld === "xyz" || tld === "info"
                        ? "orange"
                        : "green",
                    fontWeight: "bold",
                  }}
                >
                  {!tld
                    ? "Unknown"
                    : tld === "xyz" || tld === "info"
                      ? "Medium Risk"
                      : "Low Risk"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. SHAP Explanation */}
      <section
        style={{
          border: "1px solid black",
          padding: "20px",
          marginBottom: "20px",
          backgroundColor: "#fff",
        }}
      >
        <h2>SHAP Explanation</h2>
        <p style={{ color: "#64748b" }}>
          Understand what influenced this website's assessment.
        </p>

        <div
          style={{
            padding: "16px",
            backgroundColor: "#f8f9fa",
            borderRadius: "6px",
            borderLeft: "4px solid #cbd5e1",
          }}
        >
          {hasShapExplanation ? (
            <>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {shapItems.map((item) => (
                  <div key={item.feature}>
                    <strong>{item.title}</strong>

                    <p style={{ margin: "6px 0 0", lineHeight: "1.6" }}>
                      {item.description} This factor {item.direction} the
                      model's estimated phishing risk.
                    </p>
                  </div>
                ))}
              </div>

              <p
                style={{
                  margin: "18px 0 0",
                  paddingTop: "12px",
                  borderTop: "1px solid #e2e8f0",
                  color: "#64748b",
                  fontSize: "0.9em",
                  lineHeight: "1.5",
                }}
              >
                These factors help explain the model's assessment. The Risk
                Indicator column uses separate rules, so its labels may differ
                from the model's explanation. No single factor proves that a
                website is safe or malicious.
              </p>
            </>
          ) : (
            <p style={{ margin: 0, lineHeight: "1.6" }}>
              {record.model_name === "XGBoost"
                ? "A detailed explanation is not available for this scan because its feature contributions were not returned."
                : "A detailed explanation is not available because this scan did not use the trained XGBoost model."}
            </p>
          )}
        </div>
      </section>

      {/* 4. Human review */}
      <section
        style={{
          border: "1px solid black",
          padding: "20px",
          marginBottom: "20px",
          backgroundColor: "#fff",
        }}
      >
        {record.review_status === "Completed" ? (
          <div>
            <h2 style={{ color: "green", marginBottom: "10px", marginTop: 0 }}>
              Decision Recorded
            </h2>

            <p style={{ marginBottom: "12px" }}>
              This scan was reviewed
              {record.reviewer ? (
                <>
                  {" "}
                  by <strong>{record.reviewer}</strong>
                </>
              ) : (
                ""
              )}
              {reviewedAt !== "Not recorded" ? (
                <>
                  {" "}
                  on <strong>{reviewedAt}</strong>
                </>
              ) : (
                ""
              )}
              . The final decision was <strong>{record.decision}</strong>.
            </p>

            {record.model_outcome && (
              <p style={{ marginBottom: "12px" }}>
                Compared with the analyst's decision, the model outcome was{" "}
                <strong>{record.model_outcome}</strong>.
              </p>
            )}

            {record.note && (
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "6px",
                  borderLeft: "4px solid #cbd5e1",
                }}
              >
                <h4
                  style={{
                    marginTop: 0,
                    marginBottom: "8px",
                    fontSize: "14px",
                    color: "#475569",
                  }}
                >
                  Analyst Note
                </h4>
                <p
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    color: "#334155",
                    lineHeight: "1.5",
                  }}
                >
                  {record.note}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 style={{ marginBottom: "10px", marginTop: 0 }}>Human review</h2>
            <h3 style={{ marginBottom: "5px", fontSize: "16px" }}>
              Record your decision
            </h3>
            <p style={{ marginBottom: "20px", color: "#64748b" }}>
              Your decision is kept separately from the calculated risk score.
            </p>

            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ marginBottom: "12px", fontSize: "14px" }}>
                Review status
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="reviewStatus"
                    value="pending"
                    checked={reviewStatus === "pending"}
                    disabled={submitting}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    style={{ marginTop: "4px" }}
                  />
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                      Keep pending
                    </div>
                    <div style={{ color: "#64748b", fontSize: "13px" }}>
                      Leave this record open
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="reviewStatus"
                    value="phishing"
                    checked={reviewStatus === "phishing"}
                    disabled={submitting}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    style={{ marginTop: "4px" }}
                  />
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                      Phishing
                    </div>
                    <div style={{ color: "#64748b", fontSize: "13px" }}>
                      Record an analyst finding
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="reviewStatus"
                    value="not_phishing"
                    checked={reviewStatus === "not_phishing"}
                    disabled={submitting}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    style={{ marginTop: "4px" }}
                  />
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>
                      Not phishing
                    </div>
                    <div style={{ color: "#64748b", fontSize: "13px" }}>
                      Record a legitimate domain
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ marginBottom: "8px", fontSize: "14px" }}>
                <label htmlFor="analyst-note">Analyst note (optional)</label>
              </h4>
              <p
                style={{
                  fontSize: "13px",
                  color: "#64748b",
                  margin: "0 0 8px 0",
                }}
              >
                What led you to this decision?
              </p>

              <textarea
                id="analyst-note"
                disabled={submitting}
                maxLength={2000}
                aria-describedby="analyst-note-count"
                value={analystNote}
                onChange={(e) => setAnalystNote(e.target.value.slice(0, 2000))}
                style={{
                  width: "100%",
                  minHeight: "100px",
                  padding: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />

              <div
                id="analyst-note-count"
                style={{
                  textAlign: "right",
                  fontSize: "12px",
                  color: "#64748b",
                  marginTop: "4px",
                }}
              >
                {analystNote.length} / 2,000 characters
              </div>
            </div>

            {saveError && (
              <p role="alert" style={{ color: "#b91c1c" }}>
                {saveError}
              </p>
            )}

            <Button
              variant="primary"
              onClick={handleSaveDecision}
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Save decision"}
            </Button>
          </>
        )}
      </section>
    </>
  );
}
