import { Link } from 'react-router-dom';
import Header from '../components/Header';

export default function Dashboard() {
  return (
    <>
      <Header 
        title="Dashboard" 
        subtitle="Live overview of newly registered domains and flagged alerts" 
      />

      <section className="metrics-row">
        <div className="metric-card">
          <h3>DOMAINS MONITORED</h3>
          <div className="metric-sub">Today</div>
        </div>
        <div className="metric-card">
          <h3>HIGH RISK ALERTS</h3>
          <div className="metric-sub">Requires attention</div>
        </div>
        <div className="metric-card">
          <h3>AVERAGE RISK SCORE</h3>
          <div className="metric-sub">Current batch</div>
        </div>
      </section>

      <section className="filter-row">
        <input type="text" className="search-input" placeholder="Search domain..." />
        <select className="filter-select"><option>Risk: All</option></select>
        <select className="filter-select"><option>Status: All</option></select>
        <select className="filter-select"><option>Period: 24h</option></select>
        <Link to="/scan" className="btn-manual-scan">+ MANUAL SCAN</Link>
      </section>

      <section className="alerts-section">
        <h2>Recent domain alerts</h2>
        <div className="alerts-wireframe-box">
          <p>domain list / table / detected events area</p>
        </div>
      </section>

      <section className="bottom-row">
        <div className="info-card">
          <h3>RISK DISTRIBUTION</h3>
          <ul>
            <li>Low</li>
            <li>Medium</li>
            <li>High</li>
          </ul>
        </div>
        <div className="info-card">
          <h3>SYSTEM STATUS</h3>
          <ul>
            <li>• Feed collector: active</li>
            <li>• Risk scoring: status</li>
            <li>• Last data collection: Completed</li>
          </ul>
        </div>
      </section>
    </>
  );
}
