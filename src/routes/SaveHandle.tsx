import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { useIdentity } from "../components/IdentityGateProvider";
import { myContributions } from "../lib/api";

export function SaveHandle() {
  const navigate = useNavigate();
  const { profile, linkEmailPassword } = useIdentity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ toilets: 0, reviews: 0 });

  useEffect(() => {
    if (profile) myContributions(profile.id).then((c) => setCounts({ toilets: c.toilets.length, reviews: c.reviews.length }));
  }, [profile]);

  useEffect(() => {
    if (!profile) navigate("/you");
  }, [profile, navigate]);

  if (!profile) return null;

  async function send() {
    if (password.length < 6) {
      setError("Password needs to be at least 6 characters.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await linkEmailPassword(email.trim(), password);
      setSent(true);
    } catch {
      setError("Couldn't set that up — check the address and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <TopBar back title="Keep this name" />
      <div className="screen-body">
        <div className="box" style={{ borderColor: "var(--chart-4)", alignItems: "center" }}>
          <span className="num" style={{ fontSize: 16 }}>
            {profile.handle}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {counts.toilets} toilets · {counts.reviews} reviews
          </span>
        </div>

        {sent ? (
          <div className="note">
            Check your email and tap the confirmation link — after that you can log in as{" "}
            <b>{profile.handle}</b> from any device with this email and password.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, lineHeight: 1.45 }}>
              <b>What this does:</b> turns this name into a real account with an email and
              password, so you can log in and pick up right where you left off on any device.
            </div>

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
              autoComplete="new-password"
            />
            {error && <div style={{ fontSize: 12, color: "var(--text-danger)" }}>{error}</div>}
            <button className="btn" disabled={!email.trim() || !password || sending} onClick={send}>
              Create account
            </button>
            <div style={{ fontSize: 11, lineHeight: 1.45, color: "var(--text-muted)" }}>
              Your address is never shown next to your posts, and we never email you anything
              else.
            </div>
          </>
        )}

        <div className="lbl" style={{ marginTop: 4 }}>
          Already have an account
        </div>
        <div style={{ fontSize: 11, color: "var(--chart-4)", cursor: "pointer" }} onClick={() => navigate("/login")}>
          Log in instead →
        </div>
      </div>
    </>
  );
}
