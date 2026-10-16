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
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

// Core network request function that attaches the user's login token and handles errors
async function apiRequest(path, options = {}) {
  let response;
  // Get active session token from Supabase
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const headers = new Headers(options.headers);
  if (data.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }

  // Send request to the FastAPI server
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error(
      `Could not connect to the backend at ${API_BASE_URL}. Check that FastAPI is running.`,
    );
  }

  const body = await readResponseBody(response);

  // Throw descriptive error if backend responds with an error code
  if (!response.ok) {
    let message = body?.detail || body?.message;

    if (Array.isArray(message)) {
      message = message.map((item) => item.msg).join(", ");
    }

    throw new Error(
      message || `Request failed with status ${response.status}.`,
    );
  }

  return body;
}

// Checks if the backend server and OpenSquat feed are healthy and reachable
export function checkBackendHealth() {
  return apiRequest("/api/v1/health");
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

