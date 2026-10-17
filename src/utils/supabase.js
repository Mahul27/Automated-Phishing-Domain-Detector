// Sets up the Supabase client and manages password recovery session tracking.
import { createClient } from "@supabase/supabase-js";

// Supabase project connection settings from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Session storage keys and 1-hour expiration window for password recovery
const recoveryStorageKey = "passwordRecoveryStartedAt";
const recoveryWindowInMilliseconds = 60 * 60 * 1000;
let recoveryStartedAt = 0;

// Records that password recovery started in the current browser tab
export function markPasswordRecoveryStarted() {
  recoveryStartedAt = Date.now();
  try {
    sessionStorage.setItem(recoveryStorageKey, recoveryStartedAt.toString());
  } catch {
    // Recovery can continue in this page when browser storage is unavailable.
  }
}

// Checks if password recovery is currently active and within the time window
export function hasActivePasswordRecovery() {
  let startedAt = recoveryStartedAt;
  try {
    const stored = sessionStorage.getItem(recoveryStorageKey);
    if (stored !== null) startedAt = Number(stored);
  } catch {
    // Use the in-memory marker when storage is blocked.
  }
  const elapsed = Date.now() - startedAt;
  const recoveryIsActive =
    Number.isFinite(startedAt) &&
    startedAt > 0 &&
    elapsed >= 0 &&
    elapsed < recoveryWindowInMilliseconds;

  // Clear expired recovery timestamp if time has passed
  if (!recoveryIsActive) {
    clearPasswordRecovery();
  }

  return recoveryIsActive;
}

// Clears the password recovery flag once completed or signed out
export function clearPasswordRecovery() {
  recoveryStartedAt = 0;
  try {
    sessionStorage.removeItem(recoveryStorageKey);
  } catch {
    // Clearing the in-memory marker still ends recovery in this page.
  }
}

// Automatically detects if the current URL is a password recovery link
if (typeof window !== "undefined") {
  const hashParameters = new URLSearchParams(window.location.hash.slice(1));
  const queryParameters = new URLSearchParams(window.location.search);

  if (
    hashParameters.get("type") === "recovery" ||
    queryParameters.get("type") === "recovery"
  ) {
    markPasswordRecoveryStarted();
  }
}

// Initialized Supabase client used across the app for auth and database calls
export const supabase = createClient(supabaseUrl, supabaseKey);
