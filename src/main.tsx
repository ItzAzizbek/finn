import "@fontsource-variable/inter-tight";
import "@fontsource-variable/unbounded";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./store";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
