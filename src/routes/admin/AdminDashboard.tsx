import { useCallback, useEffect, useState } from "react";
import { useIdentity } from "../../components/IdentityGateProvider";
import { listReports } from "../../lib/api";
import type { Report, ReportStatus } from "../../lib/types";
import { ReportRow } from "./ReportRow";

const TABS: ReportStatus[] = ["queued", "resolved", "dismissed"];

export function AdminDashboard() {
  const { profile, loading } = useIdentity();
  const [tab, setTab] = useState<ReportStatus>("queued");
  const [reports, setReports] = useState<Report[]>([]);

  const load = useCallback(() => {
    listReports(tab).then(setReports);
  }, [tab]);

  useEffect(() => {
    if (profile?.is_admin) load();
  }, [profile, load]);

  if (loading) return <div className="screen-body">Loading…</div>;

  if (!profile || !profile.is_admin) {
    return (
      <div className="center-empty">
        <span>You're not signed in as an admin.</span>
        <span style={{ fontSize: 11 }}>
          Sign in with your real email through the normal "Keep this name" flow, then it can be
          granted from the database.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <span className="title">Moderation</span>
      </div>
      <div style={{ display: "flex", gap: 6, padding: "8px 10px 0" }}>
        {TABS.map((t) => (
          <span key={t} className={`chip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t} {t === "queued" && reports.length > 0 && tab === "queued" ? `(${reports.length})` : ""}
          </span>
        ))}
      </div>
      <div className="screen-body">
        {reports.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nothing here.</div>
        )}
        {reports.map((r) => (
          <ReportRow key={r.id} report={r} onChanged={load} />
        ))}
      </div>
    </>
  );
}
