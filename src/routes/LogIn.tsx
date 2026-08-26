import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { useIdentity } from "../components/IdentityGateProvider";

export function LogIn() {
  const navigate = useNavigate();
  const { signInWithPassword, resetPassword } = useIdentity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signInWithPassword(email.trim(), password);
      navigate("/you");
    } catch {
      setError("Wrong email or password.");
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) {
      setError("Enter your email above first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setResetSent(true);
    } catch {
      setError("Couldn't send that — check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar back title="Log in" />
      <div className="screen-body">
        <div className="lbl">Email</div>
        <input
          className="box"
          style={{ minHeight: 40 }}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          type="email"
          autoComplete="email"
        />
        <div className="lbl">Password</div>
        <input
          className="box"
          style={{ minHeight: 40 }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {error && <div style={{ fontSize: 12, color: "var(--text-danger)" }}>{error}</div>}
        {resetSent && (
          <div className="note">Check your email for a link to set a new password.</div>
        )}
        <button className="btn" disabled={!email.trim() || !password || busy} onClick={submit}>
          Log in
        </button>
        <span
          style={{ fontSize: 11, color: "var(--chart-4)", cursor: "pointer", alignSelf: "flex-start" }}
          onClick={forgotPassword}
        >
          Forgot password?
        </span>
      </div>
    </>
  );
}
