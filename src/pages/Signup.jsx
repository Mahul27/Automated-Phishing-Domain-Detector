import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleSignup = (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const confirmPassword = e.target.confirmPassword.value;

    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    // Save to localStorage for demo purposes
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userPassword", password);

    alert("Account created successfully! You can now login.");
    navigate("/");
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
            <h2 className="login-title">CREATE ACCOUNT</h2>

            {error && (
              <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}

            <form id="signup-form" onSubmit={handleSignup}>
              <div className="form-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
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

              <div className="form-group">
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  required
                />
              </div>

              <button type="submit" className="btn-login">
                Sign Up
              </button>
            </form>

            <div
              style={{
                marginTop: "15px",
                textAlign: "center",
                fontSize: "0.9em",
              }}
            >
              Already have an account? <Link to="/">Login here</Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
