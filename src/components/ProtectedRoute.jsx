// This component acts like a security guard for private pages.
// It checks whether the user is logged in before letting them view the page.
// If not logged in, it redirects them back to the login page.
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

export default function ProtectedRoute({ children }) {
  // Store the user login session and whether we are still checking it
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    let receivedAuthEvent = false;
    let initialCheckFinished = false;
    setLoading(true);
    setError("");
    const timeout = setTimeout(() => {
      if (!mounted || receivedAuthEvent || initialCheckFinished) return;
      initialCheckFinished = true;
      setError("Checking your sign-in session timed out. Please try again.");
      setLoading(false);
    }, 15000);

    // 2. Listen for any login/logout state changes in real time
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      receivedAuthEvent = true;
      clearTimeout(timeout);
      setSession(session);
      setLoading(false);
      setError("");
    });

    // A later auth event takes precedence over an older initial session lookup.
    Promise.resolve().then(() => supabase.auth.getSession()).then(({ data, error: sessionError }) => {
      if (!mounted || receivedAuthEvent || initialCheckFinished) return;
      if (sessionError) throw sessionError;
      initialCheckFinished = true;
      clearTimeout(timeout);
      setSession(data?.session ?? null);
      setLoading(false);
    }).catch((sessionError) => {
      if (!mounted || receivedAuthEvent || initialCheckFinished) return;
      initialCheckFinished = true;
      clearTimeout(timeout);
      setError(sessionError?.message || "Could not check your sign-in session.");
      setLoading(false);
    });

    // Cleanup: stop listening when component unmounts
    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [attempt]);

  // While we are still checking if the user is logged in, show a simple loading message
  if (loading) {
    return <div role="status">Checking your sign-in session...</div>;
  }

  if (error) {
    return <div role="alert">{error} <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>;
  }

  // If there is no active session (user is not logged in), send them to the login page ("/")
  if (!session) {
    return <Navigate to="/" replace />;
  }

  // If the user is logged in, show the actual protected page contents
  return children;
}
