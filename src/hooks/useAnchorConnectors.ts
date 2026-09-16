import { useCallback, useLayoutEffect, useState } from "react";
import { buildConnectorLines, type ConnectorLine } from "../utils/pdf/buildConnectorLines";

export type AnchorConnectorTarget = {
  conceptId: string;
  highlightEl: HTMLElement | null;
  conceptEl: HTMLElement | null;
};

export const useAnchorConnectors = (
  overlayEl: HTMLElement | null,
  getTargets: () => AnchorConnectorTarget[],
  enabled: boolean
): ConnectorLine[] => {
  const [lines, setLines] = useState<ConnectorLine[]>([]);

  const measure = useCallback(() => {
    if (!enabled || !overlayEl) {
      setLines([]);
      return;
    }
    const origin = overlayEl.getBoundingClientRect();
    const targets = getTargets();
    setLines(
      buildConnectorLines(
        targets
          .filter((t) => t.highlightEl)
          .map((t) => {
            const box = t.highlightEl!.getBoundingClientRect();
            return { id: t.conceptId, x: box.right, y: box.top + box.height / 2 };
          }),
        targets
          .filter((t) => t.conceptEl)
          .map((t) => {
            const box = t.conceptEl!.getBoundingClientRect();
            return { id: t.conceptId, x: box.left, y: box.top + box.height / 2 };
          }),
        { left: origin.left, top: origin.top }
      )
    );
  }, [enabled, overlayEl, getTargets]);

  useLayoutEffect(() => {
    measure();
    if (!enabled || !overlayEl) {
      return;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(overlayEl);
    for (const target of getTargets()) {
      if (target.highlightEl) {
        observer.observe(target.highlightEl);
      }
      if (target.conceptEl) {
        observer.observe(target.conceptEl);
      }
    }
    const onScroll = () => measure();
    overlayEl.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      overlayEl.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", measure);
    };
  }, [enabled, measure, overlayEl, getTargets]);

  return lines;
};
