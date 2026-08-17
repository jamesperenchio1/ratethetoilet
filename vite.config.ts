import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
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
        ],
      },
    }),
  ],
});
