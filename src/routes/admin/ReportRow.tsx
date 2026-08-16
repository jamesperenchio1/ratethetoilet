import { useEffect, useState } from "react";
import type { Report } from "../../lib/types";
import { banHandle, getReportTarget, hideContent, resolveReport } from "../../lib/api";

export function ReportRow({ report, onChanged }: { report: Report; onChanged: () => void }) {
  const [target, setTarget] = useState<Awaited<ReturnType<typeof getReportTarget>>>(undefined as never);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getReportTarget(report).then(setTarget);
  }, [report]);

  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="box">
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
        <span className="lbl">{report.target_type}</span>
        <span>{new Date(report.created_at).toLocaleString()}</span>
      </div>
      <div style={{ fontSize: 13 }}>{report.reason}</div>
      {report.note && <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>"{report.note}"</div>}
      {target === undefined ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Loading target…</div>
      ) : target === null ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Target no longer exists.</div>
      ) : report.target_type === "photo" ? (
        <img src={target.preview} alt="" style={{ height: 90, objectFit: "cover", borderRadius: 4 }} />
      ) : (
        <div className="box dashed" style={{ fontSize: 12 }}>
          {target.preview}
        </div>
      )}
      {target && (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>by {target.authorHandle ?? "unknown"}</div>
      )}

      {report.status === "queued" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            className="btn2"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await hideContent(report.target_type, report.target_id, true);
                await resolveReport(report.id, "resolved");
              })
            }
          >
            Hide content
          </button>
          <button className="btn2" disabled={busy} onClick={() => act(() => resolveReport(report.id, "dismissed"))}>
            Dismiss
          </button>
          {target?.authorId && (
            <button
              className="btn2"
              style={{ color: "var(--red-3)", borderColor: "var(--red-3)" }}
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await banHandle(target.authorId!, true);
                  await resolveReport(report.id, "resolved");
                })
              }
            >
              Ban {target.authorHandle ?? "author"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
