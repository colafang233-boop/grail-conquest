import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./accessibility.css";
import App from "./App";
import "./browser-settings";
import { initializeBrowserContent } from "./content/browser-content";
import { initializeAutosave } from "./save-game";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element was not found");

await initializeBrowserContent();
initializeAutosave();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
