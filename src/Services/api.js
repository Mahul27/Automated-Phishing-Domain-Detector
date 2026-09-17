const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function readResponseBody(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch {
    throw new Error(
      `Could not connect to the backend at ${API_BASE_URL}. Check that FastAPI is running.`,
    );
  }

  const body = await readResponseBody(response);

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

export function checkBackendHealth() {
  return apiRequest("/api/v1/health");
}

export function createScan(domain) {
  return apiRequest("/api/v1/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
}

export function fetchScans(collection) {
  const query = new URLSearchParams({ collection });
  return apiRequest(`/api/v1/scans?${query.toString()}`);
}

export function fetchScan(recordId) {
  return apiRequest(`/api/v1/scans/${recordId}`);
}

export function updateScanReview(recordId, review) {
  return apiRequest(`/api/v1/scans/${recordId}/review`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review),
  });
}

export function uploadScanFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest("/api/v1/imports", {
    method: "POST",
    body: formData,
  });
}

export function fetchDashboardSummary() {
  return apiRequest("/api/v1/dashboard/summary");
}

export { API_BASE_URL };
