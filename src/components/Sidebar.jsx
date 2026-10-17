// This is the sidebar navigation bar on the left side of the screen.
// It contains links to all major sections of the application and a Sign Out button.
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { clearPasswordRecovery, supabase } from "../utils/supabase";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Check if the analyst is currently looking at a scan review result page
  const isReviewPage = location.pathname.startsWith("/review");

  // Handle user logout: logs out from Supabase and takes user back to login page
  const handleSignOut = async (e) => {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSigningOut(true);
    setError("");
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      clearPasswordRecovery();
      if (mounted.current) navigate("/", { replace: true });
    } catch (signOutError) {
      if (mounted.current) setError(signOutError?.message || "Could not sign out. Please try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setSigningOut(false);
    }
  };

  return (
    <aside className="sidebar">
      <div>
        {/* Project / Brand title in sidebar */}
        <div className="sidebar-title">THREAT HUNTERS</div>

        {/* Navigation links list */}
        <ul className="nav-links">
          {/* Link to Live Dashboard */}
          <li>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              Live dashboard
            </NavLink>
          </li>

          {/* Link to Review Queue */}
          <li>
            <NavLink
              to="/queue"
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              Live review queue
            </NavLink>
          </li>

          {/* Link to Analyst Workspace */}
          <li>
            <NavLink
              to="/workspace"
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              Analyst Workspace
            </NavLink>
          </li>

          {/* Only show the 'Scan Result' tab when user is actually inspecting a scan */}
          {isReviewPage && (
            <li>
              <NavLink
                to={location.pathname}
                className={({ isActive }) =>
                  isActive ? "nav-item active" : "nav-item"
                }
              >
                Scan Result
              </NavLink>
            </li>
          )}
        </ul>
      </div>

      {/* Bottom section with the Sign out action */}
      <div>
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={handleSignOut} className="signout-link" disabled={signingOut} style={{ width: "100%", cursor: signingOut ? "wait" : "pointer" }}>
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
