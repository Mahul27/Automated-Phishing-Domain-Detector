// Keep manual live-fetch tracking above the routes so navigation cannot reset it.
import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Button from "./Button";
import {
  checkBackendHealth,
  fetchDashboardSummary,
  fetchScans,
  refreshLiveDomains,
} from "../Services/Client";

// Friendly error messages for feed fetch issues
const ERROR_MESSAGES = {
  invalid_limit: "Choose between 1 and 2,000 new domains per fetch.",
  refresh_in_progress:
    "A live feed refresh is already running. Try again once it completes.",
  feed_timeout:
    "The OpenSquat feed took too long to respond. Please try again later.",
  feed_unavailable:
    "Could not fetch the OpenSquat feed. Please try again later.",
  database_unavailable:
    "Could not access saved live results. Please try again later.",
  refresh_interrupted:
    "The backend no longer reports this fetch as running. Saved results have been reloaded. You can try fetching again.",
  request_failed:
    "The live feed request failed. Check that the backend is running, then try again.",
};

// Helper function to make sure counts are valid positive numbers
function safeCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

// Builds a short feedback message (success, warning, or error) after a feed refresh
// Display controlled messages, including when an older backend returns raw SQL.
function liveFeedFeedback(result) {
  if (!result) return null;

  const added = safeCount(result.added_count);
  const failed = safeCount(result.failed_count);
  const scanError =
    failed > 0
      ? `${failed} ${failed === 1 ? "domain" : "domains"} could not be scanned. Please try fetching again later.`
      : "Some domains could not be scanned. Please try fetching again later.";

  if (result.status !== "success") {
    return {
      tone: "error",
      title:
        "The live feed refresh did not complete. Saved results are still available.",
      detail:
        failed > 0
          ? scanError
          : Object.hasOwn(ERROR_MESSAGES, result.error_code)
            ? ERROR_MESSAGES[result.error_code]
            : "Could not fetch and scan new domains. Please try again later.",
      warning: null,
    };
  }

  const detail = failed > 0 || result.error ? scanError : null;
  const warning =
    result.warning_code === "fetch_time_not_saved"
      ? "The last fetch time could not be saved. Saved domain results are still available."
      : result.warning
        ? "The refresh completed with a warning. Saved domain results are still available."
        : null;

  return {
    tone: detail || warning ? "warning" : "success",
    title:
      added === 0
        ? "The feed was checked. No new domains were added."
        : `${added} new ${added === 1 ? "domain was" : "domains were"} scanned and added to the live results.`,
    detail,
    warning,
  };
}

const ACTIVE_FETCH_KEY = "apdd.activeLiveFetch.v1";
const STATUS_CHECK_DELAY = 3000;

function savedActiveFetch() {
  try {
    const job = JSON.parse(localStorage.getItem(ACTIVE_FETCH_KEY));
    if (
      typeof job?.id === "string" &&
      Number.isInteger(job.limit) && job.limit >= 1 && job.limit <= 2000 &&
      typeof job.started_at === "string" &&
      Number.isFinite(Date.parse(job.started_at))
    ) {
      return { ...job, status: "running", result: null };
    }
  } catch {
    // Storage can be blocked; the backend still recovers the active job.
  }
  return null;
}

function storeActiveFetch(job) {
  try {
    if (job) {
      localStorage.setItem(ACTIVE_FETCH_KEY, JSON.stringify({
        id: job.id, limit: job.limit, started_at: job.started_at,
        previous_job_id: job.previous_job_id,
      }));
    } else {
      localStorage.removeItem(ACTIVE_FETCH_KEY);
    }
  } catch {
    // Persistence is optional; server status remains authoritative.
  }
}

function useLiveDashboardFeed() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [job, setJob] = useState(savedActiveFetch);
  const [refreshing, setRefreshing] = useState(() => Boolean(job));
  const [refreshResult, setRefreshResult] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [statusError, setStatusError] = useState(null);
  const mounted = useRef(false);
  const hasLoaded = useRef(false);
  const readRequest = useRef(null);
  const healthRequest = useRef(null);
  const postRequest = useRef(null);
  const requestGeneration = useRef(0);
  const jobRef = useRef(job);
  const settlement = useRef(null);
  const completedJob = useRef(null);

  const publishJob = useCallback((nextJob) => {
    jobRef.current = nextJob;
    if (mounted.current) setJob(nextJob);
    // Keep the marker through the final saved-results reload as well.
    if (nextJob) storeActiveFetch(nextJob);
  }, []);

  const reload = useCallback(async () => {
    if (readRequest.current) return readRequest.current;
    const request = (async () => {
      if (mounted.current) setLoading(!hasLoaded.current);
      try {
        const [scans, dashboard] = await Promise.all([
          fetchScans("live"), fetchDashboardSummary(),
        ]);
        if (mounted.current) {
          setRecords(scans.records || []);
          setSummary(dashboard);
          setError(null);
          setHasData(true);
          hasLoaded.current = true;
        }
        return true;
      } catch (err) {
        if (mounted.current) setError(err.message || "Could not load live results.");
        return false;
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();
    readRequest.current = request;
    try {
      return await request;
    } finally {
      if (readRequest.current === request) readRequest.current = null;
    }
  }, []);

  const finishJob = useCallback(async (finished) => {
    if (!mounted.current) return;
    if (settlement.current?.id === finished.id) return settlement.current.promise;
    if (completedJob.current === finished.id) return;
    publishJob(finished);
    setRefreshing(true);
    const request = (async () => {
      // An earlier snapshot may have started while scans were still being saved.
      if (readRequest.current) await readRequest.current;
      await reload();
      if (mounted.current && jobRef.current?.id === finished.id) {
        completedJob.current = finished.id;
        publishJob(finished);
        setRefreshResult(finished.result);
        setRefreshing(false);
        postRequest.current = null;
        storeActiveFetch(null);
      }
    })();
    settlement.current = { id: finished.id, promise: request };
    try {
      await request;
    } finally {
      if (settlement.current?.promise === request) settlement.current = null;
    }
  }, [publishJob, reload]);

  const syncStatus = useCallback(async (fresh = false) => {
    if (healthRequest.current) {
      const previous = healthRequest.current;
      if (!fresh) return previous;
      await previous;
      if (healthRequest.current === previous) healthRequest.current = null;
    }
    const generation = requestGeneration.current;
    if (mounted.current) setCheckingStatus(true);
    const request = (async () => {
      try {
        const backendHealth = await checkBackendHealth();
        if (!mounted.current || generation !== requestGeneration.current) return backendHealth;
        setHealth(backendHealth);
        setStatusError(null);
        const source = backendHealth.opensquat;
        const remote = source?.refresh_job;
        if (remote?.status === "running") {
          // An older in-flight health response must not revive a finished job.
          if (settlement.current?.id !== remote.id && completedJob.current !== remote.id) {
            publishJob(remote);
            setRefreshResult(null);
            setRefreshing(true);
          }
        } else if (remote?.result && ["success", "failed"].includes(remote.status)) {
          // A status read can beat a newly submitted POST to the server.
          // Do not mistake the previous job's result for this pending fetch.
          if (jobRef.current?.status === "running" && remote.id === jobRef.current.previous_job_id) {
            if (!postRequest.current) {
              await finishJob({
                ...jobRef.current, status: "failed",
                result: { status: "failed", added_count: 0, error_code: "refresh_interrupted" },
              });
            }
          } else if (jobRef.current?.status === "running" || settlement.current?.id === remote.id) {
            await finishJob(remote);
          } else {
            // A retained result from an old visit is history, not a new fetch.
            completedJob.current = remote.id;
          }
        } else if (source?.refresh_running) {
          // Compatibility with a fetch started before the backend was upgraded.
          publishJob(jobRef.current?.status === "running" ? jobRef.current : {
            id: "existing-live-fetch", status: "running", limit: null, started_at: null,
          });
          setRefreshing(true);
        } else if (jobRef.current?.status === "running" && !postRequest.current) {
          await finishJob({
            ...jobRef.current,
            status: "failed",
            result: { status: "failed", added_count: 0, error_code: "refresh_interrupted" },
          });
        }
        return backendHealth;
      } catch {
        if (mounted.current && generation === requestGeneration.current) {
          setStatusError("Could not check the live fetch status. Reconnect to the backend and try again.");
        }
        return null;
      } finally {
        if (mounted.current) setCheckingStatus(false);
      }
    })();
    healthRequest.current = request;
    try {
      return await request;
    } finally {
      if (healthRequest.current === request) healthRequest.current = null;
    }
  }, [finishJob, publishJob]);

  useEffect(() => {
    mounted.current = true;
    syncStatus();
    return () => { mounted.current = false; };
  }, [syncStatus]);

  useEffect(() => {
    if (!refreshing) return;
    let cancelled = false;
    let timer;
    const poll = async () => {
      await syncStatus();
      if (!cancelled) timer = window.setTimeout(poll, STATUS_CHECK_DELAY);
    };
    timer = window.setTimeout(poll, STATUS_CHECK_DELAY);
    const reconnect = () => { syncStatus(); };
    window.addEventListener("online", reconnect);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", reconnect);
    };
  }, [refreshing, syncStatus]);

  const refresh = async (limit) => {
    if (postRequest.current || jobRef.current?.status === "running" || !mounted.current) return;
    const pending = {
      id: `pending-${Date.now()}`, status: "running", limit,
      started_at: new Date().toISOString(), result: null,
      previous_job_id: health?.opensquat?.refresh_job?.id || null,
    };
    const token = {};
    requestGeneration.current += 1;
    postRequest.current = token;
    publishJob(pending);
    setRefreshing(true);
    setRefreshResult(null);
    setStatusError(null);
    try {
      const result = await refreshLiveDomains(limit);
      if (!mounted.current || postRequest.current !== token) return;
      if (result.error_code === "refresh_in_progress") {
        if (result.job_id) publishJob({ ...jobRef.current, id: result.job_id });
        postRequest.current = null;
        await syncStatus(true);
      } else if (["success", "failed"].includes(result.status)) {
        const current = jobRef.current;
        if (result.job_id && current.id !== pending.id && current.id !== result.job_id) return;
        await finishJob({
          ...current, id: result.job_id || current.id,
          status: result.status, result,
        });
        // Refresh source readiness and the persisted last-fetch timestamp.
        await syncStatus(true);
      } else {
        throw new Error("Unexpected live feed response");
      }
    } catch {
      if (mounted.current && postRequest.current === token) {
        postRequest.current = null;
        // A lost HTTP connection does not mean the server stopped scanning.
        await syncStatus(true);
      }
    } finally {
      if (postRequest.current === token) postRequest.current = null;
    }
  };

  return {
    records, summary, health, hasData, loading, error, refreshing, refreshResult,
    checkingStatus, statusError, job, reload, refresh, retryStatus: () => syncStatus(true),
    feedback: liveFeedFeedback(refreshResult),
  };
}

function LiveFetchProgress({ feed }) {
  const [now, setNow] = useState(Date.now);
  const startedAt = Date.parse(feed.job?.started_at);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Number.isFinite(startedAt) ? Math.max(0, Math.floor((now - startedAt) / 1000)) : null;
  const elapsed = seconds === null ? "Unavailable" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const updating = feed.job?.status !== "running";
  const title = feed.statusError
    ? "Reconnecting to your domain fetch…"
    : updating
      ? "Updating dashboard results…"
      : feed.job?.limit
        ? `Fetching and scanning up to ${feed.job.limit.toLocaleString()} new domains…`
        : "Fetching and scanning new domains…";

  return (
    <section className="live-feed-progress live-feed-progress-global" aria-label="Live domain fetch">
      <div className="live-feed-progress-header">
        <p role="status" className="live-feed-progress-title">{title}</p>
        <span className="live-feed-elapsed" aria-live="off">Time elapsed: {elapsed}</span>
      </div>
      <div className="live-feed-progress-track" role="progressbar" aria-label={title} aria-describedby="live-feed-progress-hint">
        <span className="live-feed-progress-indicator" />
      </div>
      <p id="live-feed-progress-hint" className="live-feed-progress-hint">
        {feed.statusError
          ? "The connection was lost. Your fetch may still be running; we are checking its status automatically."
          : "Please wait until the loading bar disappears. Your results will update automatically."}
      </p>
    </section>
  );
}

export default function Layout() {
  const liveFeed = useLiveDashboardFeed();
  const { pathname } = useLocation();
  const [dismissedJob, setDismissedJob] = useState(null);
  const feedback = liveFeed.feedback;
  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="main-content">
        {liveFeed.refreshing && <LiveFetchProgress feed={liveFeed} />}
        {liveFeed.statusError && !liveFeed.refreshing && (
          <div role="alert" className="state-box live-feed-error">
            <p>{liveFeed.statusError}</p>
            <Button onClick={liveFeed.retryStatus} disabled={liveFeed.checkingStatus}>RETRY FETCH STATUS</Button>
          </div>
        )}
        {!liveFeed.refreshing && feedback && pathname !== "/dashboard" && dismissedJob !== liveFeed.job?.id && (
          <div
            role={feedback.tone === "success" ? "status" : "alert"}
            className={`state-box live-feed-notice live-feed-${feedback.tone}`}
          >
            <div>
              <p>{feedback.title}</p>
              {feedback.detail && <p>{feedback.detail}</p>}
              {feedback.warning && <p>{feedback.warning}</p>}
            </div>
            <Button variant="text" size="small" onClick={() => setDismissedJob(liveFeed.job?.id)}>DISMISS</Button>
          </div>
        )}
        <Outlet context={{ liveFeed }} />
      </main>
    </div>
  );
}
