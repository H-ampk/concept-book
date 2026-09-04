import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import "./index.css";

registerSW({ immediate: true });

const root = ReactDOM.createRoot(document.getElementById("root")!);

const boot = async () => {
  const bootParams = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV && bootParams.has("graphPerf")) {
    const { ConceptGraphPerformanceHarness } = await import("./dev/ConceptGraphPerformanceHarness");
    root.render(
      <React.StrictMode>
        <ConceptGraphPerformanceHarness />
      </React.StrictMode>
    );
    return;
  }

  if (import.meta.env.DEV && bootParams.has("e2eGraphLayout")) {
    const { GraphWorkspaceE2eHarness } = await import("./dev/GraphWorkspaceE2eHarness");
    root.render(
      <React.StrictMode>
        <GraphWorkspaceE2eHarness />
      </React.StrictMode>
    );
    return;
  }

  if (import.meta.env.DEV && bootParams.has("e2eListWorkspace")) {
    const { ListWorkspaceE2eHarness } = await import("./dev/ListWorkspaceE2eHarness");
    root.render(
      <React.StrictMode>
        <ListWorkspaceE2eHarness />
      </React.StrictMode>
    );
    return;
  }

  if (import.meta.env.DEV && bootParams.has("e2eConceptRelations")) {
    const { ConceptRelationsE2eHarness } = await import("./dev/ConceptRelationsE2eHarness");
    root.render(
      <React.StrictMode>
        <ConceptRelationsE2eHarness />
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
