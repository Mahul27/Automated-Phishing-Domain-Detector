import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;
    
    // Simple check matching previous vanilla js logic
    if (username === 'admin' && password === 'password') {
      navigate('/dashboard');
    } else {
      alert('Invalid credentials! (Use admin/password)');
    }
  };

  return (
    <div className="container">
      <header className="header">
        <span className="brand-title">Automated Phishing Domain Detector</span>
      </header>

      <main className="content">
        <section className="image-section">
          <div className="image-placeholder">image</div>
        </section>

        <section className="login-section">
          <h2 className="login-title">LOGIN</h2>
          
          <form id="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <input type="text" name="username" placeholder="Username or Email" required />
            </div>

            <div className="form-group">
              <input type="password" name="password" placeholder="Password" required />
            </div>

            <div className="form-row">
              <label htmlFor="remember">
                <input type="checkbox" id="remember" name="remember" /> Remember me
              </label>
              <a href="#">Forgot password?</a>
            </div>

            <button type="submit" className="btn-login">Login button</button>
          </form>
        </section>
      </main>
    </div>
  );
}
