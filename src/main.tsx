import "./instrument"; // must be the first import — see file for why

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import "./styles/global.css";
import App from "./App";
import { IdentityGateProvider } from "./components/IdentityGateProvider";
import "./registerSW";

createRoot(document.getElementById("root")!, {
  // React 19's own error-handler hooks — Sentry.ErrorBoundary below still
  // catches errors for the fallback UI, this is what actually reports them.
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{ padding: 24, textAlign: "center" }}>
          <p>Something went wrong. Try reloading.</p>
          <button className="btn" style={{ width: "auto" }} onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      }
    >
      <BrowserRouter>
        <IdentityGateProvider>
          <App />
        </IdentityGateProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
