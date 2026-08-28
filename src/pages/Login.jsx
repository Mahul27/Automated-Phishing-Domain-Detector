import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    // Retrieve stored credentials from localStorage
    const storedEmail = localStorage.getItem("userEmail");
    const storedPassword = localStorage.getItem("userPassword");

    // Check against local storage or default admin
    if (
      (username === storedEmail && password === storedPassword) ||
      (username === 'admin' && password === 'password')
    ) {
      localStorage.setItem("activeUser", username);
      navigate("/dashboard");
    } else {
      setError("Invalid credentials! Please check your email and password.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="container">
        <header className="header">
          <span className="brand-title">
            Automated Phishing Domain Detector
          </span>
        </header>

        <main className="content">
          <section className="image-section">
            <div className="image-placeholder">image</div>
          </section>

          <section className="login-section">
            <h2 className="login-title">LOGIN</h2>

            {error && (
              <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}

            <form id="login-form" onSubmit={handleLogin}>
              <div className="form-group">
                <input
                  type="text"
                  name="username"
                  placeholder="Username or Email"
                  required
                />
              </div>

              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  required
                />
              </div>

              <div className="form-row">
                <label htmlFor="remember">
                  <input type="checkbox" id="remember" name="remember" />{" "}
                  Remember me
                </label>
                <a href="#">Forgot password?</a>
              </div>

              <button type="submit" className="btn-login">
                Login button
              </button>
            </form>

            <div
              style={{
                marginTop: "15px",
                textAlign: "center",
                fontSize: "0.9em",
              }}
            >
              Don't have an account? <Link to="/signup">Sign up here</Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
