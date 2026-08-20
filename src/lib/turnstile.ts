/**
 * Cloudflare Turnstile, invisible/managed mode — raises the bar against
 * scripted spam on the add-toilet and post-review flows without putting a
 * checkbox or puzzle in front of a real user. No-ops entirely (returns null
 * immediately) when VITE_TURNSTILE_SITE_KEY isn't set, so it's off by
 * default until a site key is configured.
 *
 * This only gates the web UI's own submit flow — it can't stop someone who
 * calls PostgREST directly with a scripted request. Real server-side
 * enforcement would need an edge function or a DB extension (pg_net) to
 * verify the token before insert; left as a follow-up if API-level abuse
 * actually shows up.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          size: "invisible";
          callback: (token: string) => void;
          "error-callback"?: () => void;
        }
      ) => string;
      remove: (id: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("Failed to load Turnstile"));
      document.head.appendChild(el);
    });
  }
  return scriptPromise;
}

/** Resolves to a token, or null if Turnstile is disabled or fails — callers
 * should treat null as "skip the check", not as a hard failure, so a
 * Turnstile outage never blocks someone from posting. */
export async function getTurnstileToken(): Promise<string | null> {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  try {
    await loadScript();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.display = "none";
    document.body.appendChild(container);
    const cleanup = (id: string) => {
      window.turnstile?.remove(id);
      container.remove();
    };
    let id: string;
    id = window.turnstile!.render(container, {
      sitekey: siteKey,
      size: "invisible",
      callback: (token) => {
        resolve(token);
        cleanup(id);
      },
      "error-callback": () => {
        resolve(null);
        cleanup(id);
      },
    });
  });
}
