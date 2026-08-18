import { registerSW } from "virtual:pwa-register";
import { CONFIG } from "./lib/config";

// The generated service worker already calls skipWaiting() + clientsClaim()
// unconditionally (registerType: "autoUpdate"), so a new deploy takes over as
// soon as the browser notices the sw.js bytes changed — which by default only
// happens on a fresh navigation, so an already-open tab could sit on a stale
// build indefinitely. Polling registration.update() catches it while the tab
// stays open, and reloading once the new worker actually takes control is what
// swaps the running page over to the new code (skipWaiting alone doesn't).
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => registration.update(), CONFIG.storage.swPollMs);
  },
});

let reloadedForUpdate = false;
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (reloadedForUpdate) return;
  reloadedForUpdate = true;
  window.location.reload();
});
