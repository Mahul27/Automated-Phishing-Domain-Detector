import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isReviewPage = location.pathname.startsWith("/review");

  const handleSignOut = async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-title">THREAT HUNTERS</div>
        <ul className="nav-links">
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

      <div>
        <a href="/" onClick={handleSignOut} className="signout-link">
          Sign out
        </a>
      </div>
    </aside>
  );
}
