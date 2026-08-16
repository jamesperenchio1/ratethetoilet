import { useEffect, useState } from "react";
import { listSavedIds } from "../lib/savedList";
import { getToilet } from "../lib/api";
import { ToiletCard } from "../components/toilet/ToiletCard";
import type { Toilet } from "../lib/types";

export function Saved() {
  const [toilets, setToilets] = useState<Toilet[] | null>(null);

  useEffect(() => {
    listSavedIds().then(async (ids) => {
      const rows = await Promise.all(ids.map((id) => getToilet(id)));
      setToilets(rows.filter((r): r is Toilet => !!r));
    });
  }, []);

  return (
    <>
      <div className="topbar">
        <span className="title">Saved</span>
      </div>
      <div className="screen-body">
        {toilets && toilets.length === 0 && (
          <div className="center-empty">
            <span>Nothing saved yet.</span>
            <span style={{ fontSize: 11 }}>
              Saved toilets live on this device until you keep your name.
            </span>
          </div>
        )}
        {toilets?.map((t) => (
          <ToiletCard key={t.id} toilet={t} />
        ))}
      </div>
    </>
  );
}
