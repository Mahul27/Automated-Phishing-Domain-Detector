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

  useEffect(() => {
    // 1. Check if the user already has an active login session right now
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Listen for any login/logout state changes in real time
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    // Cleanup: stop listening when component unmounts
    return () => subscription.unsubscribe();
  }, []);

  // While we are still checking if the user is logged in, show a simple loading message
  if (loading) {
    return <div>Loading...</div>;
  }

  // If there is no active session (user is not logged in), send them to the login page ("/")
  if (!session) {
    return <Navigate to="/" replace />;
  }

  // If the user is logged in, show the actual protected page contents
  return children;
}
