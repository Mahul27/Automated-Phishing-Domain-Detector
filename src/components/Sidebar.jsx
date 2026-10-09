// This is the sidebar navigation bar on the left side of the screen.
// It contains links to all major sections of the application and a Sign Out button.
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Check if the analyst is currently looking at a scan review result page
  const isReviewPage = location.pathname.startsWith("/review");

  // Handle user logout: logs out from Supabase and takes user back to login page
  const handleSignOut = async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    navigate("/");
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
        <a href="/" onClick={handleSignOut} className="signout-link">
          Sign out
        </a>
      </div>
    </aside>
  );
}
