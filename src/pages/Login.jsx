// This is the login page where users enter their email and password to sign in.
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import logo from "../assets/logo.webp"; // Using the uploaded logo
import Button from "../components/Button";
import { clearPasswordRecovery, supabase } from "../utils/supabase";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  // Stores error message if login fails
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Handles form submission and signs the user in with Supabase
  const handleLogin = async (e) => {
    e.preventDefault();
    if (pending.current) return;
    const email = e.currentTarget.username.value.trim();
    const password = e.currentTarget.password.value;
    setError("");
    pending.current = true;
    setSubmitting(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      if (mounted.current) {
        clearPasswordRecovery();
        navigate("/dashboard", { replace: true });
      }
    } catch (loginError) {
      if (mounted.current) setError(loginError?.message || "Could not sign in. Please try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setSubmitting(false);
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
              <div role="alert" style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}
            {location.state?.message && <div role="status" style={{ marginBottom: "10px" }}>{location.state.message}</div>}

            {/* Login input form */}
            <form id="login-form" onSubmit={handleLogin}>
              {/* Email field */}
              <div className="form-group">
                <input
                  type="email"
                  name="username"
                  placeholder="Email Address"
                  aria-label="Email address"
                  autoComplete="username"
                  disabled={submitting}
                  required
                />
              </div>

              {/* Password field */}
              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  aria-label="Password"
                  autoComplete="current-password"
                  disabled={submitting}
                  required
                />
              </div>

              {/* Forgot password link */}
              <div className="form-row" style={{ justifyContent: "flex-end" }}>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>

              {/* Submit button */}
              <Button type="submit" variant="outline" fullWidth size="large" disabled={submitting}>
                {submitting ? "Signing in..." : "Login"}
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

