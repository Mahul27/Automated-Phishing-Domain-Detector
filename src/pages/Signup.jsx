// This is the signup page where new users can register for an account.
import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Button from "../components/Button";
import logo from "../assets/logo.webp";
import { clearPasswordRecovery, supabase } from "../utils/supabase";

export default function Signup() {
  const navigate = useNavigate();
  // Stores error message if signup fails
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Handles form submission to create a new user account with Supabase
  const handleSignup = async (e) => {
    e.preventDefault();
    if (pending.current) return;
    const email = e.currentTarget.email.value.trim();
    const password = e.currentTarget.password.value;
    const confirmPassword = e.currentTarget.confirmPassword.value;
    setError("");

    // Check that both passwords match before sending
    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    pending.current = true;
    setSubmitting(true);
    try {
      const { data, error: signupError } = await supabase.auth.signUp({ email, password });
      if (signupError) throw signupError;
      if (!mounted.current) return;
      if (data?.session) {
        clearPasswordRecovery();
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true, state: { message: "Account created. Check your email to confirm it before logging in." } });
      }
    } catch (signupError) {
      if (mounted.current) setError(signupError?.message || "Could not create your account. Please try again.");
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

          {/* Registration form box */}
          <section className="login-section">
            <h2 className="login-title">CREATE ACCOUNT</h2>

            {/* Error message banner */}
            {error && (
              <div role="alert" style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}

            {/* Account creation form */}
            <form id="signup-form" onSubmit={handleSignup}>
              {/* Email field */}
              <div className="form-group">
                <input
                  type="email"
                  name="email"
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
                  autoComplete="new-password"
                  disabled={submitting}
                  minLength="8"
                  required
                />
              </div>

              {/* Confirm password field */}
              <div className="form-group">
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  aria-label="Confirm password"
                  autoComplete="new-password"
                  disabled={submitting}
                  minLength="8"
                  required
                />
              </div>

              {/* Create account button */}
              <Button type="submit" variant="outline" fullWidth size="large" disabled={submitting}>
                {submitting ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            {/* Link back to login page */}
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

