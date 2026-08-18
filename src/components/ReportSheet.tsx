import { useState } from "react";
import { Sheet } from "./layout/Sheet";
import { fileReport } from "../lib/api";
import { CONFIG } from "../lib/config";
import type { ReportTargetType } from "../lib/types";

const PHOTO_REASONS = CONFIG.report.photoReasons;
const CONTENT_REASONS = CONFIG.report.contentReasons;

export function ReportSheet({
  targetType,
  targetId,
  reporterId,
  contextLabel,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  reporterId: string | null;
  contextLabel: string;
  onClose: () => void;
}) {
  const [sent, setSent] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const reasons = targetType === "photo" ? PHOTO_REASONS : CONTENT_REASONS;

  async function submit(reason: string) {
    setSending(true);
    try {
      const report = await fileReport(reporterId, targetType, targetId, reason);
      setReportId(report.id);
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Sheet onDismiss={onClose}>
        <b style={{ fontSize: 15 }}>Thanks — it's queued</b>
        <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--text-secondary)" }}>
          Hidden from everyone until a moderator looks, usually within a day.
        </div>
        {reportId && (
          <div className="box dashed" style={{ fontSize: 11 }}>
            Report #<span className="num">{reportId.slice(0, 8)}</span> — we'll show the
            outcome here if you keep this phone
          </div>
        )}
        <button className="ghost" onClick={onClose}>
          Done
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet onDismiss={onClose}>
      <b style={{ fontSize: 15 }}>
        Report this {targetType === "photo" ? "photo" : targetType === "review" ? "review" : "toilet"}
      </b>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{contextLabel}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {reasons.map((r) => (
          <button
            key={r}
            className="btn2"
            style={{ textAlign: "left" }}
            disabled={sending}
            onClick={() => submit(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
