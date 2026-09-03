import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import "./index.css";

registerSW({ immediate: true });

const root = ReactDOM.createRoot(document.getElementById("root")!);

const boot = async () => {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("graphPerf")) {
    const { ConceptGraphPerformanceHarness } = await import("./dev/ConceptGraphPerformanceHarness");
    root.render(
      <React.StrictMode>
        <ConceptGraphPerformanceHarness />
      </React.StrictMode>
    );
    return;
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

void boot();
