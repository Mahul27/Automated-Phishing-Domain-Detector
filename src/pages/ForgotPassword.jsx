// This page lets users request a password reset email or set a new password from a recovery link.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import logo from "../assets/logo.webp";
import {
  clearPasswordRecovery,
  hasActivePasswordRecovery,
  markPasswordRecoveryStarted,
  supabase,
} from "../utils/supabase";

// Reads error descriptions from the URL if a password reset link is invalid or expired
function getConfirmationLinkError() {
  const hashParameters = new URLSearchParams(window.location.hash.slice(1));
  const queryParameters = new URLSearchParams(window.location.search);

  return (
    hashParameters.get("error_description") ||
    queryParameters.get("error_description")
  );
}

// Main Forgot Password component
export default function ForgotPassword() {
  const navigate = useNavigate();
  // Status tracking: checking recovery link, ready to set new password, or sending/submitting
  const [checkingRecovery, setCheckingRecovery] = useState(() =>
    hasActivePasswordRecovery(),
  );
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const mounted = useRef(true);
  const pending = useRef(false);
  const redirectTimer = useRef(null);

  // Feedback messages
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Check if the user arrived via a valid recovery link
  useEffect(() => {
    let componentIsMounted = true;
    let recoveryEventReceived = false;
    mounted.current = true;

    // Shows the new password input form once verified
    const showNewPasswordForm = (session) => {
      if (!componentIsMounted || !session) return;

      setRecoveryReady(true);
      setCheckingRecovery(false);
      setError("");
      setSuccess("");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!componentIsMounted) return;
      if (event === "PASSWORD_RECOVERY") {
        recoveryEventReceived = true;
        markPasswordRecoveryStarted();
        showNewPasswordForm(session);
      }

      if (event === "SIGNED_OUT") {
        recoveryEventReceived = true;
        clearPasswordRecovery();
        setRecoveryReady(false);
        setCheckingRecovery(false);
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
        if (!componentIsMounted || recoveryEventReceived) return;

        if (sessionError) throw sessionError;

        if (data?.session) {
          showNewPasswordForm(data.session);
          return;
        }

        clearPasswordRecovery();
        setError(
          "This confirmation link is invalid or has expired. Please request a new email.",
        );
        setCheckingRecovery(false);
      }).catch((sessionError) => {
        if (!componentIsMounted || recoveryEventReceived) return;
        setError(sessionError?.message || "Could not check your confirmation link. Please try again.");
        setCheckingRecovery(false);
      });
    } else {
      setCheckingRecovery(false);
    }

    return () => {
      componentIsMounted = false;
      mounted.current = false;
      clearTimeout(redirectTimer.current);
      subscription.unsubscribe();
    };
  }, []);

  // Step 1: Sends a password reset email to the user's address
  const handleSendConfirmationEmail = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    const inputEmail = event.currentTarget.email.value.trim();

    setError("");
    setSuccess("");
    setSending(true);
    pending.current = true;
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        inputEmail,
        { redirectTo: `${window.location.origin}/forgot-password` },
      );
      if (resetError) throw resetError;
      if (mounted.current) setSuccess(
        "If an account exists for this email, a confirmation email has been sent. Open it and click the confirmation link to choose a new password.",
      );
    } catch (resetError) {
      if (mounted.current) setError(resetError?.message || "Could not send the confirmation email. Please try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setSending(false);
    }
  };

  // Step 2: Saves the new password chosen by the user
  const handleResetPassword = async (event) => {
    event.preventDefault();
    if (pending.current) return;
    const newPassword = event.currentTarget.newPassword.value;
    const confirmPassword = event.currentTarget.confirmPassword.value;

    setError("");
    setSuccess("");

    // Make sure new passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!recoveryReady) {
      setError("Open a valid confirmation link before changing your password.");
      return;
    }

    setSubmitting(true);
    pending.current = true;
    let updated = false;
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      updated = true;
      clearPasswordRecovery();
      if (mounted.current) {
        setPasswordChanged(true);
        setRecoveryReady(false);
        setSuccess("Password changed successfully! Returning to login...");
      }
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      if (mounted.current) redirectTimer.current = setTimeout(() => {
        navigate("/", { replace: true });
      }, 1500);
    } catch (updateError) {
      if (mounted.current) {
        if (updated) setSuccess("Password changed successfully. Use the login link below to continue.");
        setError(updateError?.message || "Could not finish password recovery. Please try again.");
      }
    } finally {
      pending.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="container">
        {/* Branding header */}
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

          {/* Form card section */}
          <section className="login-section">
            <h2 className="login-title">
              {recoveryReady ? "CREATE NEW PASSWORD" : "RESET PASSWORD"}
            </h2>

            {/* Link checking message */}
            {checkingRecovery && (
              <div role="status" style={{ marginBottom: "10px" }}>
                Checking your confirmation link...
              </div>
            )}
            {/* Error banner */}
            {error && (
              <div role="alert" style={{ color: "red", marginBottom: "10px" }}>{error}</div>
            )}
            {/* Success banner */}
            {success && (
              <div role="status" style={{ color: "green", marginBottom: "10px" }}>
                {success}
              </div>
            )}

            {/* Step 1 Form: Request password reset link */}
            {!checkingRecovery && !recoveryReady && !passwordChanged && (
              <form onSubmit={handleSendConfirmationEmail}>
                <div className="form-group">
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your registered email"
                    aria-label="Registered email address"
                    autoComplete="email"
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

            {/* Step 2 Form: Enter and confirm new password */}
            {recoveryReady && !success && (
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <input
                    type="password"
                    name="newPassword"
                    placeholder="New Password"
                    aria-label="New password"
                    autoComplete="new-password"
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
                    aria-label="Confirm new password"
                    autoComplete="new-password"
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

            {/* Link to login page */}
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
