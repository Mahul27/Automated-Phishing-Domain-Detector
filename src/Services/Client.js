// API client for connecting the frontend to the FastAPI Python backend server.
import { supabase } from "../utils/supabase";

// Base URL where the backend is hosted
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// File import limits: maximum 1,000 domain records and 2 MB file size
export const MAX_IMPORT_RECORDS = 1000;
export const MAX_IMPORT_FILE_BYTES = 2_000_000;

// Helper function to safely read JSON or text from an API response
async function readResponseBody(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      throw new Error("The backend returned an unreadable response. Please try again.");
    }
  }

  if (response.ok) {
    throw new Error("The backend returned an unexpected response. Check the API address and try again.");
  }
  // Proxy HTML and plain-text tracebacks are not safe user-facing messages.
  return null;
}

function isTechnicalMessage(message) {
  return message.length > 500 || /[\r\n]|<[^>]+>|\[SQL:|\[parameters:|sqlalchemy|pymysql|sqlalche\.me|traceback|\bINSERT\s+INTO\b|\bSELECT\s+.+\s+FROM\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b|\b(?:password|passwd|secret|(?:access_|refresh_)?token|authorization|api_key)["']?\s*[:=]|sb_secret_|(?:mysql|postgres(?:ql)?|sqlite|mssql)(?:\+\w+)?:\/\/|\/(?:Users|home|var|private|usr|opt|tmp)\/|[A-Za-z]:\\/i.test(message);
}

function responseError(body, status) {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status >= 500) return "The backend could not complete this request. Please try again.";
  let message = body?.detail || body?.message;
  if (Array.isArray(message)) {
    message = message.map((item) => typeof item?.msg === "string" ? item.msg : "").filter(Boolean).join(", ");
  }
  if (typeof message !== "string") return `Request failed with status ${status}.`;
  message = message.replace(/^Could not parse file:\s*(?:\d{3}:\s*)?/i, "");
  if (isTechnicalMessage(message)) {
    return "The backend could not complete this request. Please try again.";
  }
  return message || `Request failed with status ${status}.`;
}

// Core network request function that attaches the user's login token and handles errors
async function apiRequest(path, options = {}) {
  const {
    authenticate = true,
    timeoutMs = (options.method || "GET").toUpperCase() === "GET" ? 15000 : 0,
    signal: externalSignal,
    ...requestOptions
  } = options;
  const controller = new AbortController();
  let timedOut = false;
  let rejectAborted;
  const aborted = new Promise((_, reject) => { rejectAborted = reject; });
  const handleAbort = () => {
    controller.abort(externalSignal?.reason);
    rejectAborted(new DOMException("Request cancelled.", "AbortError"));
  };
  const timeout = timeoutMs > 0 ? setTimeout(() => {
    timedOut = true;
    handleAbort();
  }, timeoutMs) : null;
  externalSignal?.addEventListener("abort", handleAbort, { once: true });

  const execute = async () => {
    const headers = new Headers(requestOptions.headers);
    if (authenticate) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw new Error(error.message || "Could not check your sign-in session.");
      if (data?.session?.access_token) {
        headers.set("Authorization", `Bearer ${data.session.access_token}`);
      }
    }
    controller.signal.throwIfAborted();
    let response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...requestOptions, headers, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error(`Could not connect to the backend at ${API_BASE_URL}. Check that FastAPI is running.`, { cause: error });
    }
    const body = await readResponseBody(response);
    if (!response.ok) throw new Error(responseError(body, response.status));
    return body;
  };
  try {
    if (externalSignal?.aborted) handleAbort();
    return await Promise.race([execute(), aborted]);
  } catch (error) {
    if (timedOut) throw new Error("The backend request timed out. Please try again.", { cause: error });
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", handleAbort);
  }
}

// Checks if the backend server and OpenSquat feed are healthy and reachable
export function checkBackendHealth() {
  // Status tracking must recover if the backend becomes unreachable mid-fetch.
  return apiRequest("/api/v1/health", { authenticate: false, timeoutMs: 10000 });
}

// Sends a single domain to be scanned and analyzed for phishing
export function createScan(domain) {
  return apiRequest("/api/v1/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
}

// Fetches a list of scans ("personal" or "live")
export function fetchScans(collection) {
  const query = new URLSearchParams({ collection });
  return apiRequest(`/api/v1/scans?${query.toString()}`);
}

// Fetches full scan details for a specific record by its ID
export function fetchScan(recordId) {
  return apiRequest(`/api/v1/scans/${recordId}`);
}

// Updates the analyst review decision and note for a scan
export function updateScanReview(recordId, review) {
  return apiRequest(`/api/v1/scans/${recordId}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review),
  });
}

// Validates and uploads a CSV or JSON file containing domains to scan in bulk
export function uploadScanFile(file) {
  if (!file || typeof file.name !== "string") {
    throw new Error("Choose a CSV or JSON file to import.");
  }
  // Validate file type
  if (!/\.(csv|json)$/i.test(file.name)) {
    throw new Error("Only CSV and JSON files are supported.");
  }
  // Validate file size limit (2 MB)
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error("File must be 2 MB or smaller.");
  }

  const formData = new FormData();
  formData.append("file", file);

  return apiRequest("/api/v1/imports", {
    method: "POST",
    body: formData,
  }).then((result) => {
    if (!Array.isArray(result?.errors)) return result;
    const fallback = "Could not scan this record. Please try again later.";
    return {
      ...result,
      errors: result.errors.map((error) => {
        if (typeof error !== "string" || !error.trim()) return fallback;
        if (!isTechnicalMessage(error)) return error;
        const rowNumber = error.match(/^Row[ \t]{1,8}(\d{1,6}):/i)?.[1];
        const row = rowNumber ? `Row ${rowNumber}: ` : "";
        return `${row}${fallback}`;
      }),
    };
  });
}

// Fetches overview summary stats and weekly trends for the Live Dashboard
export function fetchDashboardSummary() {
  return apiRequest("/api/v1/dashboard/summary");
}

// Triggers OpenSquat to pull new live domains and scan them
export function refreshLiveDomains(limit = 10) {
  const query = new URLSearchParams({ limit });
  return apiRequest(`/api/v1/opensquat/refresh?${query.toString()}`, {
    method: "POST",
  });
}

export { API_BASE_URL };

