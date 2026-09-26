import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import logo from "../assets/logo.webp";
import {
  clearPasswordRecovery,
  hasActivePasswordRecovery,
  markPasswordRecoveryStarted,
  supabase,
} from "../utils/supabase";

function getConfirmationLinkError() {
  const hashParameters = new URLSearchParams(window.location.hash.slice(1));
  const queryParameters = new URLSearchParams(window.location.search);

  return (
    hashParameters.get("error_description") ||
    queryParameters.get("error_description")
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [checkingRecovery, setCheckingRecovery] = useState(() =>
    hasActivePasswordRecovery(),
  );
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let componentIsMounted = true;

    const showNewPasswordForm = (session) => {
      if (!componentIsMounted || !session) return;

      setRecoveryReady(true);
      setCheckingRecovery(false);
      setError("");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecoveryStarted();
        showNewPasswordForm(session);
      }

      if (event === "SIGNED_OUT") {
        clearPasswordRecovery();
      }
    });

    const linkError = getConfirmationLinkError();

    if (linkError) {
      clearPasswordRecovery();
      setError(linkError);
      setCheckingRecovery(false);
    } else if (hasActivePasswordRecovery()) {
      // Supabase may process the confirmation link before React finishes
      // loading, so also check for the temporary recovery session.
      supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!componentIsMounted) return;

        if (sessionError) {
          setError(sessionError.message);
          setCheckingRecovery(false);
          return;
        }

        if (data.session) {
          showNewPasswordForm(data.session);
          return;
        }

        clearPasswordRecovery();
        setError(
          "This confirmation link is invalid or has expired. Please request a new email.",
        );
        setCheckingRecovery(false);
      });
    } else {
      setCheckingRecovery(false);
    }

    return () => {
      componentIsMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSendConfirmationEmail = async (event) => {
    event.preventDefault();
    const inputEmail = event.target.email.value;

    setError("");
    setSuccess("");
    setSending(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      inputEmail,
      { redirectTo: `${window.location.origin}/forgot-password` },
    );

    if (resetError) {
      setError(resetError.message);
      setSending(false);
      return;
    }

    // A generic message avoids revealing whether an account exists.
    setSuccess(
      "If an account exists for this email, a confirmation email has been sent. Open it and click the confirmation link to choose a new password.",
    );
    setSending(false);
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    const newPassword = event.target.newPassword.value;
    const confirmPassword = event.target.confirmPassword.value;

    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setSuccess("Password changed successfully! Returning to login...");
    clearPasswordRecovery();
    await supabase.auth.signOut();

    setTimeout(() => {
      navigate("/");
    }, 1500);
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
            <h2 className="login-title">
              {recoveryReady ? "CREATE NEW PASSWORD" : "RESET PASSWORD"}
            </h2>

            {checkingRecovery && (
              <div style={{ marginBottom: "10px" }}>
                Checking your confirmation link...
              </div>
            )}
            {error && (
              <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}
            {success && (
              <div style={{ color: "green", marginBottom: "10px" }}>
                {success}
              </div>
            )}

            {!checkingRecovery && !recoveryReady && (
              <form onSubmit={handleSendConfirmationEmail}>
                <div className="form-group">
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your registered email"
                    disabled={sending}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  fullWidth
                  size="large"
                  disabled={sending}
                >
                  {sending ? "Sending..." : "Send Confirmation Email"}
                </Button>
              </form>
            )}

            {recoveryReady && !success && (
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <input
                    type="password"
                    name="newPassword"
                    placeholder="New Password"
                    minLength="8"
                    disabled={submitting}
                    required
                  />
                </div>
                <div className="form-group">
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm New Password"
                    minLength="8"
                    disabled={submitting}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  fullWidth
                  size="large"
                  disabled={submitting}
                >
                  {submitting ? "Resetting..." : "Reset Password"}
                </Button>
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
