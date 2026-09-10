import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

type Mode = "login" | "register" | "reset";

function authMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code) : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "An account already uses this email. Try signing in.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Choose a stronger password.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled. Contact an administrator.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/account-exists-with-different-credential":
      return "This email uses another sign-in method. Sign in with that method.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return error instanceof Error && !code ? error.message : "Authentication failed. Please try again.";
  }
}

function Login() {
  const { loginWithGoogle, registerWithEmail, loginWithEmail, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const accountMessage = (location.state as { accountMessage?: unknown } | null)?.accountMessage;
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(typeof accountMessage === "string" ? accountMessage : "");
  const [loading, setLoading] = useState(false);

  const changeMode = (next: Mode) => {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setMessage("");

    if (mode === "register") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    try {
      setLoading(true);
      if (mode === "reset") {
        await resetPassword(email);
        setMessage("If an account exists for this email, password-reset instructions have been sent. Check your inbox and spam folder.");
      } else if (mode === "register") {
        await registerWithEmail(email, password);
        navigate("/");
      } else {
        await loginWithEmail(email, password);
        navigate("/");
      }
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setError("");
    setMessage("");
    try {
      setLoading(true);
      await loginWithGoogle();
      navigate("/");
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setLoading(false);
    }
  };


  return (
  <main className="login-page">
    <section className="login-shell">
      <div className="login-brand-panel">
        <p className="login-eyebrow">
          Formula 1 Analytics
        </p>

        <h1>
          Race Data.
          <br />
          Driver Insight.
          <br />
          Better Analysis.
        </h1>

        <p className="login-brand-description">
          Explore Formula 1 drivers, races,
          constructors and performance analytics
          in one place.
        </p>

        <div className="login-brand-line" />
      </div>

      <div className="login-form-panel">
        <div className="login-form-header">
          <p className="login-form-label">
            {mode === "login"
              ? "Welcome Back"
              : mode === "register"
                ? "Join the Grid"
                : "Account Recovery"}
          </p>

          <h2>
            {mode === "login"
              ? "Sign In"
              : mode === "register"
                ? "Create Account"
                : "Reset Password"}
          </h2>

          <p>
            {mode === "login"
              ? "Sign in to access your account and contributor tools."
              : mode === "register"
                ? "Create an account to get started."
                : "Enter your email and we'll send password-reset instructions."}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="login-message login-message-error"
          >
            {error}
          </p>
        )}

        {message && (
          <p
            role="status"
            className="login-message login-message-success"
          >
            {message}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="login-form"
        >
          <label className="login-field">
            <span>Email</span>

            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              disabled={loading}
              placeholder="you@example.com"
            />
          </label>

          {mode !== "reset" && (
            <label className="login-field">
              <span>Password</span>

              <input
                type="password"
                autoComplete={
                  mode === "register"
                    ? "new-password"
                    : "current-password"
                }
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                minLength={
                  mode === "register"
                    ? 8
                    : undefined
                }
                required
                disabled={loading}
                placeholder="Enter your password"
              />
            </label>
          )}

          {mode === "register" && (
            <label className="login-field">
              <span>
                Confirm Password
              </span>

              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value
                  )
                }
                minLength={8}
                required
                disabled={loading}
                placeholder="Confirm your password"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-primary-button"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : "Send reset email"}
          </button>
        </form>

        {mode !== "reset" && (
          <>
            <div className="login-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="login-google-button"
            >
              Sign in with Google
            </button>
          </>
        )}

        <div className="login-links">
          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={() =>
                  changeMode("reset")
                }
                disabled={loading}
              >
                Forgot password?
              </button>

              <button
                type="button"
                onClick={() =>
                  changeMode("register")
                }
                disabled={loading}
              >
                Don't have an account?{" "}
                <strong>Register</strong>
              </button>
            </>
          )}

          {mode !== "login" && (
            <button
              type="button"
              onClick={() =>
                changeMode("login")
              }
              disabled={loading}
            >
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </section>
  </main>
);
}

export default Login;
