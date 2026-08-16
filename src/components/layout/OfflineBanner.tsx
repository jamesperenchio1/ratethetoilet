import { useEffect, useState } from "react";
import { useOnlineStatus } from "../../lib/useOnlineStatus";
import { listQueued, flushQueue } from "../../lib/offlineQueue";
import { useIdentity } from "../IdentityGateProvider";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const { profile } = useIdentity();
  const [queuedCount, setQueuedCount] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    listQueued().then((items) => setQueuedCount(items.length));
  }, [online]);

  useEffect(() => {
    if (online && profile && queuedCount > 0) {
      void trySend();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, profile?.id]);

  async function trySend() {
    if (!profile) return;
    setSending(true);
    try {
      const { remaining } = await flushQueue(profile.id);
      setQueuedCount(remaining);
    } finally {
      setSending(false);
    }
  }

  if (online && queuedCount === 0) return null;

  return (
    <div className="offline-banner">
      {!online
        ? `No signal. ${queuedCount} post${queuedCount === 1 ? "" : "s"} waiting — they'll go up on their own when you're back.`
        : sending
          ? "Sending queued posts…"
          : `${queuedCount} post${queuedCount === 1 ? "" : "s"} queued.`}
      {online && queuedCount > 0 && !sending && (
        <>
          {" "}
          <span
            style={{ textDecoration: "underline", cursor: "pointer" }}
            onClick={trySend}
          >
            Try sending now
          </span>
        </>
      )}
    </div>
  );
}
