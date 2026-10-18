import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startAnalytics } from "./analytics";
import App from "./App";
import { routeExternalLinks } from "./external";
import "./styles.css";

routeExternalLinks();
startAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
