// This is the login page where users enter their email and password to sign in.
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import logo from "../assets/logo.webp"; // Using the uploaded logo
import Button from "../components/Button";
import { supabase } from "../utils/supabase";

export default function Login() {
  const navigate = useNavigate();
  // Stores error message if login fails
  const [error, setError] = useState("");

  // Handles form submission and signs the user in with Supabase
  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.username.value;
    const password = e.target.password.value;

    // Send credentials to Supabase Auth
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Display error message or redirect to dashboard on success
    if (error) {
      setError(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="container">
        {/* Application branding header */}
        <header className="header">
          <span className="brand-title">
            Automated Phishing Domain Detector
          </span>
        </header>

        <main className="content">
          {/* Logo illustration */}
          <section className="image-section">
            <img
              src={logo}
              alt="Threat Hunters Logo"
              style={{ width: "100%", height: "auto", borderRadius: "8px" }}
            />
          </section>

          {/* Login form box */}
          <section className="login-section">
            <h2 className="login-title">LOGIN</h2>

            {/* Error message banner */}
            {error && (
              <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}

            {/* Login input form */}
            <form id="login-form" onSubmit={handleLogin}>
              {/* Email field */}
              <div className="form-group">
                <input
                  type="email"
                  name="username"
                  placeholder="Email Address"
                  required
                />
              </div>

              {/* Password field */}
              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  required
                />
              </div>

              {/* Forgot password link */}
              <div className="form-row" style={{ justifyContent: "flex-end" }}>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>

              {/* Submit button */}
              <Button type="submit" variant="outline" fullWidth size="large">
                Login
              </Button>
            </form>

            {/* Link to create a new account */}
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

