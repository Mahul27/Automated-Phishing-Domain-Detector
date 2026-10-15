// This is the signup page where new users can register for an account.
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Button from "../components/Button";
import logo from "../assets/logo.webp";
import { supabase } from "../utils/supabase";

export default function Signup() {
  const navigate = useNavigate();
  // Stores error message if signup fails
  const [error, setError] = useState("");

  // Handles form submission to create a new user account with Supabase
  const handleSignup = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const confirmPassword = e.target.confirmPassword.value;

    // Check that both passwords match before sending
    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    // Call Supabase signup API
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    // Handle signup response
    if (error) {
      setError(error.message);
    } else if (data.session) {
      // Direct login if email confirmation is not required
      navigate("/dashboard");
    } else {
      // Prompt user to verify email
      alert(
        "Account created. Check your email to confirm it before logging in.",
      );
      navigate("/");
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
              <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}

            {/* Account creation form */}
            <form id="signup-form" onSubmit={handleSignup}>
              {/* Email field */}
              <div className="form-group">
                <input
                  type="email"
                  name="email"
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
                  minLength="8"
                  required
                />
              </div>

              {/* Create account button */}
              <Button type="submit" variant="outline" fullWidth size="large">
                Create Account
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

