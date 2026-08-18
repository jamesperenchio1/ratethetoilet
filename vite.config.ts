import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

// maplibre-gl's worker script imports a sibling chunk ("./maplibre-gl-shared.mjs")
// by its exact, unhashed dist filename. Vite's normal asset pipeline (and even a
// `?url` import) would rename/hash that sibling, breaking the worker's relative
// import at runtime. Instead, copy both files verbatim — same names, same
// directory — so the worker's hardcoded import keeps resolving, in both dev and
// build. Served at a fixed path; see setWorkerUrl() in MapView.tsx.
function maplibreWorkerAssets(): Plugin {
  const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
  const srcDir = resolve(rootDir, "node_modules/maplibre-gl/dist");
  return {
    name: "maplibre-worker-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = files.find((f) => req.url === `/maplibre-assets/${f}`);
        if (!file) return next();
        res.setHeader("Content-Type", "text/javascript");
        res.end(readFileSync(resolve(srcDir, file)));
      });
    },
    closeBundle() {
      const outDir = resolve(rootDir, "dist/maplibre-assets");
      mkdirSync(outDir, { recursive: true });
      for (const f of files) copyFileSync(resolve(srcDir, f), resolve(outDir, f));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    maplibreWorkerAssets(),
    VitePWA({
      registerType: "autoUpdate",
      // Registered manually from src/registerSW.ts — the default injected script
      // only registers the worker and never reloads open tabs when a new one
      // takes over, so deploys could sit uninstalled in an open tab indefinitely.
      injectRegister: false,
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "RateTheToilet",
        short_name: "RateTheToilet",
        description: "Find a public toilet you can trust.",
        theme_color: "#0e1419",
        background_color: "#eae6d9",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/storage/v1/object/public/"),
            handler: "CacheFirst",
            options: { cacheName: "toilet-photos", expiration: { maxEntries: 200 } },
          },
          {
            // Map tiles + style JSON — cache so repeat visits render instantly
            // instead of re-fetching the whole basemap every time.
            urlPattern: ({ url }) => url.hostname === "tiles.openfreemap.org",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
