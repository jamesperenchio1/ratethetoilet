import { TopBar } from "../components/layout/TopBar";

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div className="box" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
      <b style={{ fontSize: 14 }}>{title}</b>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}

export function Rules() {
  return (
    <>
      <TopBar back title="Content rules" />
      <div className="screen-body" style={{ gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          These rules keep Rate The Toilet useful and safe for everyone. Breaking
          them can get your listing or review removed.
        </div>

        <Rule
          title="Photos"
          body="Faces are fine. Don't post your own mess or urine — that's on you. A broken toilet with waste left behind is okay: that's the venue's problem, and people need to see it."
        />

        <Rule
          title="Be honest"
          body="Rate the toilet as you found it. Don't post misleading photos, fake scores, or reviews of places you haven't actually used."
        />

        <Rule
          title="No personal info"
          body="Never post someone's name, face that clearly identifies a private person, or any personal information without their consent."
        />

        <Rule
          title="No spam or self-promotion"
          body="Don't post adverts, repeated content, or links to unrelated products and services."
        />

        <Rule
          title="Report what breaks the rules"
          body="See something that shouldn't be here? Tap the flag on any listing, photo, or review to report it. Reports are reviewed and hidden if they break these rules."
        />

        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          We may remove content that violates these rules, with or without notice.
        </div>
      </div>
    </>
  );
}
