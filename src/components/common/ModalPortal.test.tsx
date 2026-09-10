import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModalPortal } from "./ModalPortal";

describe("ModalPortal", () => {
  it("children を document.body 直下へ portal する", () => {
    render(
      <main className="relative z-10">
        <ModalPortal>
          <div data-testid="ported-overlay">overlay</div>
        </ModalPortal>
      </main>
    );

    const overlay = screen.getByTestId("ported-overlay");
    expect(overlay.parentElement).toBe(document.body);
    expect(document.querySelector("main")?.contains(overlay)).toBe(false);
  });
});
