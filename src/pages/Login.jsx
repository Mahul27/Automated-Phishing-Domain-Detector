import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import logo from "../assets/logo.webp"; // Using the uploaded logo
import Button from "../components/Button";
import { supabase } from "../utils/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.username.value;
    const password = e.target.password.value;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      navigate("/dashboard");
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
            <img
              src={logo}
              alt="Threat Hunters Logo"
              style={{ width: "100%", height: "auto", borderRadius: "8px" }}
            />
          </section>

          <section className="login-section">
            <h2 className="login-title">LOGIN</h2>

            {error && (
              <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}

            <form id="login-form" onSubmit={handleLogin}>
              <div className="form-group">
                <input
                  type="email"
                  name="username"
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

              <div className="form-row" style={{ justifyContent: "flex-end" }}>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>

              <Button type="submit" variant="outline" fullWidth size="large">
                Login
              </Button>
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
