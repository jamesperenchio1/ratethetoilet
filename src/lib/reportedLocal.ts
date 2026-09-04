// Tracks what this device has reported, so a reported photo/review/hint can
// disappear for the reporter right away. The `reports` table isn't readable
// by non-admins, so there's no server-side way to answer "did I report this".
const KEY = "rtt_reported_locally_v1";

function readAll(): Record<string, true> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, true>) : {};
  } catch {
    return {};
  }
}

export function markReportedLocally(targetType: string, targetId: string): void {
  try {
    const all = readAll();
    all[`${targetType}:${targetId}`] = true;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Private browsing / storage disabled — reporting still succeeded server-side.
  }
}

export function isReportedLocally(targetType: string, targetId: string): boolean {
  try {
    return readAll()[`${targetType}:${targetId}`] === true;
  } catch {
    return false;
  }
}
