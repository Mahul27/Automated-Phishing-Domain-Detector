import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const recoveryStorageKey = "passwordRecoveryStartedAt";
const recoveryWindowInMilliseconds = 60 * 60 * 1000;

export function markPasswordRecoveryStarted() {
  sessionStorage.setItem(recoveryStorageKey, Date.now().toString());
}

export function hasActivePasswordRecovery() {
  const startedAt = Number(sessionStorage.getItem(recoveryStorageKey));
  const recoveryIsActive =
    Number.isFinite(startedAt) &&
    startedAt > 0 &&
    Date.now() - startedAt < recoveryWindowInMilliseconds;

  if (!recoveryIsActive) {
    sessionStorage.removeItem(recoveryStorageKey);
  }

  return recoveryIsActive;
}

export function clearPasswordRecovery() {
  sessionStorage.removeItem(recoveryStorageKey);
}

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

export const supabase = createClient(supabaseUrl, supabaseKey);
