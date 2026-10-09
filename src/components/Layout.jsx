// This component serves as the main frame/shell for the dashboard.
// It places the navigation Sidebar on the left and renders the active page content on the right.
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    <div className="dashboard-container">
      {/* Left side navigation menu */}
      <Sidebar />

      {/* Main content area where nested pages (Dashboard, Queue, etc.) appear */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
