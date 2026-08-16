import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { useIdentity } from "../components/IdentityGateProvider";
import { myContributions } from "../lib/api";

export function SaveHandle() {
  const navigate = useNavigate();
  const { profile, sendKeepNameLink } = useIdentity();
  const [email, setEmail] = useState("");
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
    setSending(true);
    setError(null);
    try {
      await sendKeepNameLink(email.trim());
      setSent(true);
    } catch {
      setError("Couldn't send that link — check the address and try again.");
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
            Check your email — tap the link on any phone to sign in as <b>{profile.handle}</b>{" "}
            there too.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, lineHeight: 1.45 }}>
              <b>What this does:</b> leave an address and we can hand this exact name back to you
              on a new phone. That is all it does.
            </div>

            <div className="lbl">Email or phone</div>
            <input
              className="box"
              style={{ minHeight: 40 }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
            />
            {error && <div style={{ fontSize: 12, color: "var(--text-danger)" }}>{error}</div>}
            <button className="btn" disabled={!email.trim() || sending} onClick={send}>
              Send me the link
            </button>
            <div style={{ fontSize: 11, lineHeight: 1.45, color: "var(--text-muted)" }}>
              No password. No profile. We never email you anything else, and your address is
              never shown next to your posts.
            </div>
          </>
        )}

        <div className="lbl" style={{ marginTop: 4 }}>
          On a new phone already
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Open the link from your email on this phone and it'll sign you in automatically.
        </div>
      </div>
    </>
  );
}
