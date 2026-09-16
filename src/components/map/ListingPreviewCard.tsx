import { useEffect, useRef, useState } from "react";
import { getToilet, photoUrl } from "../../lib/api";
import { distanceLabel, venueTypesLabel } from "../../lib/labels";
import { ScoreBadge } from "../toilet/ScoreBadge";
import type { ToiletWithAuthor } from "../../lib/types";

/**
 * The "which pin did I just tap?" card: shown after tapping a map pin, before
 * committing to the full detail page. Swiping the photo strip and reading the
 * name/score here is enough to confirm it's the right listing among a
 * cluster of nearby ones — tapping the card itself (outside the close
 * button) opens the full detail page.
 */
export function ListingPreviewCard({
  toiletId,
  title,
  score,
  count,
  distanceMeters,
  onClose,
  onOpen,
}: {
  toiletId: string;
  title: string;
  score: number | null;
  count?: number;
  distanceMeters?: number;
  onClose: () => void;
  onOpen: () => void;
}) {
  const [detail, setDetail] = useState<ToiletWithAuthor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setActiveIndex(0);
    getToilet(toiletId)
      .then((t) => {
        if (!cancelled) setDetail(t);
      })
      .catch(() => {
        /* preview stays photo-less on failure — the full detail page will retry */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toiletId]);

  const photos = detail?.photos?.filter((p) => !p.hidden) ?? [];

  function onScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div
      className="box"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}
    >
      <div style={{ position: "relative" }}>
        {photos.length > 0 ? (
          <div
            ref={scrollerRef}
            onScroll={onScroll}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              height: 140,
            }}
          >
            {photos.map((p) => (
              <img
                key={p.id}
                src={photoUrl(p.storage_path)}
                alt=""
                onClick={onOpen}
                style={{
                  flex: "0 0 100%",
                  width: "100%",
                  height: 140,
                  objectFit: "cover",
                  scrollSnapAlign: "start",
                  cursor: "pointer",
                  background: "var(--surface-note)",
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              height: 90,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "var(--text-muted)",
              background: "var(--surface-note)",
            }}
          >
            {loading ? "Loading…" : "No photos yet"}
          </div>
        )}

        {photos.length > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: 6,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              gap: 4,
            }}
          >
            {photos.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: i === activeIndex ? "#fff" : "rgba(255,255,255,.5)",
                  boxShadow: "0 0 2px rgba(0,0,0,.6)",
                }}
              />
            ))}
          </div>
        )}

        <span
          role="button"
          tabIndex={0}
          aria-label="Close preview"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onClose();
            }
          }}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "rgba(0,0,0,.5)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </span>
      </div>

      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <b style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </b>
          <ScoreBadge score={score} size={18} />
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: "2px 6px" }}>
          {count && count > 1 && <span>{count} toilets here</span>}
          {detail && <span>{venueTypesLabel(detail.venue_types)}</span>}
          {distanceMeters != null && <span>· {distanceLabel(distanceMeters)}</span>}
          <span style={{ color: "var(--chart-4)", marginLeft: "auto" }}>View details ›</span>
        </div>
      </div>
    </div>
  );
}
