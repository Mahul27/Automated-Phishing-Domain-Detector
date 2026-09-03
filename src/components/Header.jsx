export default function Header({ title, subtitle, tag, noBorder = false }) {
  const activeUser = localStorage.getItem('activeUser') || 'Logged in';

  return (
    <div className={`header-row ${noBorder ? 'no-border' : ''}`}>
      <div className="header-title">
        {tag && <div className="header-tag">{tag}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="user-badge">{activeUser}</div>
    </div>
  );
}
