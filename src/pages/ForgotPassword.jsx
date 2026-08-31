import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from "../assets/logo.webp";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleVerifyEmail = (e) => {
    e.preventDefault();
    const inputEmail = e.target.email.value;
    const storedEmail = localStorage.getItem("userEmail");

    if (inputEmail === storedEmail) {
      setStep(2);
      setError("");
    } else {
      setError("Email not found in our records.");
    }
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    const newPassword = e.target.newPassword.value;
    const confirmPassword = e.target.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    localStorage.setItem("userPassword", newPassword);
    setSuccess("Password reset successfully!");
    setError("");

    setTimeout(() => {
      navigate("/");
    }, 2000);
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
            <h2 className="login-title">RESET PASSWORD</h2>

            {error && (
              <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}
            {success && (
              <div style={{ color: "green", marginBottom: "10px" }}>
                {success}
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleVerifyEmail}>
                <div className="form-group">
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your registered email"
                    required
                  />
                </div>
                <button type="submit" className="btn-login">
                  Verify Email
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <input
                    type="password"
                    name="newPassword"
                    placeholder="New Password"
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm New Password"
                    required
                  />
                </div>
                <button type="submit" className="btn-login">
                  Reset Password
                </button>
              </form>
            )}

            <div
              style={{
                marginTop: "15px",
                textAlign: "center",
                fontSize: "0.9em",
              }}
            >
              Remember your password? <Link to="/">Login here</Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
