import Header from "../components/Header";

export default function ScanHistory() {
  return (
    <>
      <Header 
        title="Scan History" 
        subtitle="Search and review earlier detection records." 
      />

      <section className="filter-row">
        <input type="text" className="search-input" placeholder="Search by domain or scan ID" />
        <select className="filter-select"><option>Date range</option></select>
        <select className="filter-select"><option>Risk level</option></select>
        <select className="filter-select"><option>Decision</option></select>
        <button type="button" className="btn-manual-scan">CLEAR FILTERS</button>
      </section>

      <div style={{ fontSize: '13px', marginBottom: '-10px' }}>Showing detection records</div>

      <section className="history-box">
        <p>SCAN ID DOMAIN DATE / TIME RISK PREDICTION SCORE DECISION ACTION</p>
      </section>

      <div className="pagination">
        <a href="#">&lt; PREVIOUS</a> 1 2 3 ... 10 <a href="#">NEXT &gt;</a>
      </div>

      <section className="empty-state-box">
        <strong>EMPTY STATE</strong>
        <p>No detection records match the selected filters. Clear filters or try another search.</p>
      </section>
    </>
  );
}
