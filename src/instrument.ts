// Must be the first import in main.tsx — Sentry has to initialize before any
// other app code runs so it can catch errors from that code too.
import * as Sentry from "@sentry/react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import React from "react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

// No-op without a DSN — local dev and PR previews don't need (or have) one.
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,

    integrations: [
      // Route-aware tracing (proper integration for react-router v7 with hooks,
      // not the plain browserTracingIntegration) + session replay.
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        // Toilet photos/reviews can include identifying details — mask/block
        // by default rather than recording raw session content.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Tracing
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    tracePropagationTargets: ["localhost", import.meta.env.VITE_SUPABASE_URL],

    // Session Replay
    replaysSessionSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,

    enableLogs: true,
  });
}
