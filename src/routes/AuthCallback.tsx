import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIdentity } from "../components/IdentityGateProvider";

export function AuthCallback() {
  const navigate = useNavigate();
  const { session, profile } = useIdentity();
  const [tooLong, setTooLong] = useState(false);

  useEffect(() => {
    if (session && profile) {
      const t = setTimeout(() => navigate("/you"), 900);
      return () => clearTimeout(t);
    }
    const timeout = setTimeout(() => setTooLong(true), 6000);
    return () => clearTimeout(timeout);
  }, [session, profile, navigate]);

  return (
    <div className="center-empty">
      {session && profile ? (
        <>
          <b style={{ color: "var(--text-primary)" }}>You're in as {profile.handle}</b>
          <span>Taking you to your posts…</span>
        </>
      ) : tooLong ? (
        <>
          <span>That link may have expired.</span>
          <button className="btn" style={{ width: "auto" }} onClick={() => navigate("/you")}>
            Back to You
          </button>
        </>
      ) : (
        <span>Signing you in…</span>
      )}
    </div>
  );
}
