export default function Header({ title, subtitle }) {
  const activeUser = localStorage.getItem('activeUser') || 'Logged in';

  return (
    <div className="header-row">
      <div className="header-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="user-badge">{activeUser}</div>
    </div>
  );
}
