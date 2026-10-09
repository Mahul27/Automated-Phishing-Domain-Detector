// This component renders the top header bar shown at the top of pages.
// It displays the main page title, optional subtitle, an optional category tag,
// and the role of the logged-in user (e.g. "Analyst").

export default function Header({ title, subtitle, tag, noBorder = false }) {
  // Current user display role
  const activeUser = 'Analyst';

  return (
    <div className={`header-row ${noBorder ? 'no-border' : ''}`}>
      <div className="header-title">
        {/* If a tag or badge was provided, show it above the title */}
        {tag && <div className="header-tag">{tag}</div>}
        
        {/* Main page heading */}
        <h1>{title}</h1>
        
        {/* If a subtitle description was provided, show it */}
        {subtitle && <p>{subtitle}</p>}
      </div>

      {/* Badge showing who is logged in */}
      <div className="user-badge">{activeUser}</div>
    </div>
  );
}
