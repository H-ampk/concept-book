import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import { ThemeProvider, hydrateTheme } from "./theme";
import "./index.css";

hydrateTheme();

registerSW({ immediate: true });

const root = ReactDOM.createRoot(document.getElementById("root")!);

const boot = async () => {
  const bootParams = new URLSearchParams(window.location.search);
  if (import.meta.env.DEV && bootParams.has("graphConfusion")) {
    const { ConceptGraphConfusionHarness } = await import("./dev/ConceptGraphConfusionHarness");
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <ConceptGraphConfusionHarness />
        </ThemeProvider>
      </React.StrictMode>
    );
    return;
  }

  if (import.meta.env.DEV && bootParams.has("graphPerf")) {
    const { ConceptGraphPerformanceHarness } = await import("./dev/ConceptGraphPerformanceHarness");
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <ConceptGraphPerformanceHarness />
        </ThemeProvider>
      </React.StrictMode>
    );
    return;
  }

  if (import.meta.env.DEV && bootParams.has("e2eGraphLayout")) {
    const { GraphWorkspaceE2eHarness } = await import("./dev/GraphWorkspaceE2eHarness");
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <GraphWorkspaceE2eHarness />
        </ThemeProvider>
      </React.StrictMode>
    );
    return;
  }

  if (import.meta.env.DEV && bootParams.has("e2eListWorkspace")) {
    const { ListWorkspaceE2eHarness } = await import("./dev/ListWorkspaceE2eHarness");
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <ListWorkspaceE2eHarness />
        </ThemeProvider>
      </React.StrictMode>
    );
    return;
  }

  if (import.meta.env.DEV && bootParams.has("e2eConceptRelations")) {
    const { ConceptRelationsE2eHarness } = await import("./dev/ConceptRelationsE2eHarness");
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <ConceptRelationsE2eHarness />
        </ThemeProvider>
      </React.StrictMode>
    );
    return;
  }

  if (import.meta.env.DEV && bootParams.has("e2eSkillTree")) {
    const { SkillTreeE2eHarness } = await import("./dev/SkillTreeE2eHarness");
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <SkillTreeE2eHarness />
        </ThemeProvider>
      </React.StrictMode>
    );
    return;
  }

  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
};

void boot();
