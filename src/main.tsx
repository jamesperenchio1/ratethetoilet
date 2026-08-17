import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/global.css";
import App from "./App";
import { IdentityGateProvider } from "./components/IdentityGateProvider";
import "./registerSW";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <IdentityGateProvider>
        <App />
      </IdentityGateProvider>
    </BrowserRouter>
  </StrictMode>
);
