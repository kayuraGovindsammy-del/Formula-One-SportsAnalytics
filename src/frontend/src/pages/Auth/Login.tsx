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

  const fieldStyle = {
    width: "100%",
    padding: "12px",
    boxSizing: "border-box" as const,
    borderRadius: "6px",
    border: "1px solid #555",
    background: "#252525",
    color: "#fff",
    fontSize: "16px",
  };

  const buttonStyle = {
    width: "100%",
    padding: "12px",
    border: "none",
    borderRadius: "6px",
    cursor: loading ? "not-allowed" : "pointer",
    fontSize: "16px",
    fontWeight: "bold" as const,
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", justifyContent: "center",
      alignItems: "center", background: "#111", color: "white", padding: "20px",
      boxSizing: "border-box",
    }}>
      <div style={{
        width: "100%", maxWidth: "400px", padding: "32px",
        background: "#1c1c1c", borderRadius: "12px", textAlign: "center",
      }}>
        <h1>F1 Analytics</h1>
        <p style={{ marginBottom: "24px", color: "#aaa" }}>
          {mode === "login" ? "Sign in to continue" :
            mode === "register" ? "Create your account" : "Reset your password"}
        </p>

        {error && <p role="alert" style={{ color: "#ff7373" }}>{error}</p>}
        {message && <p role="status" style={{ color: "#86efac" }}>{message}</p>}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px", textAlign: "left" }}>
          <label>
            <span style={{ display: "block", marginBottom: "6px" }}>Email</span>
            <input style={fieldStyle} type="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              required disabled={loading} />
          </label>

          {mode !== "reset" && (
            <label>
              <span style={{ display: "block", marginBottom: "6px" }}>Password</span>
              <input style={fieldStyle} type="password"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password} onChange={e => setPassword(e.target.value)}
                minLength={mode === "register" ? 8 : undefined}
                required disabled={loading} />
            </label>
          )}

          {mode === "register" && (
            <label>
              <span style={{ display: "block", marginBottom: "6px" }}>Confirm password</span>
              <input style={fieldStyle} type="password" autoComplete="new-password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                minLength={8} required disabled={loading} />
            </label>
          )}

          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? "Please wait..." :
              mode === "login" ? "Sign in" :
              mode === "register" ? "Create account" : "Send reset email"}
          </button>
        </form>

        {mode !== "reset" && (
          <>
            <p style={{ color: "#aaa", margin: "20px 0" }}>or</p>
            <button type="button" onClick={handleGoogleLogin} disabled={loading}
              style={buttonStyle}>
              Sign in with Google
            </button>
          </>
        )}

        <div style={{ marginTop: "22px", display: "grid", gap: "10px" }}>
          {mode === "login" && (
            <>
              <button type="button" onClick={() => changeMode("reset")} disabled={loading}
                style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer" }}>
                Forgot password?
              </button>
              <button type="button" onClick={() => changeMode("register")} disabled={loading}
                style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer" }}>
                Don't have an account? Register
              </button>
            </>
          )}
          {mode !== "login" && (
            <button type="button" onClick={() => changeMode("login")} disabled={loading}
              style={{ background: "none", border: "none", color: "#93c5fd", cursor: "pointer" }}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
