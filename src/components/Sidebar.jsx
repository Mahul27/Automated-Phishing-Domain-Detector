import { NavLink, Link, useLocation } from "react-router-dom";

export default function Sidebar() {
  const location = useLocation();
  const isReviewPage = location.pathname.startsWith("/review");

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
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/scan"
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              Manual Scan
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/upload"
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              Data Upload
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              History
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
        <Link to="/" className="signout-link">
          Sign out
        </Link>
      </div>
    </aside>
  );
}
