import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataLabBarChart } from "./DataLabBarChart";

describe("DataLabBarChart", () => {
  it("カテゴリラベルを描画する", () => {
    render(
      <DataLabBarChart
        rows={[{ key: "c1", label: "人工知能", value: 0.784, attemptCount: 18 }]}
        metric="accuracy"
      />
    );
    expect(screen.getByTestId("data-lab-bar-chart")).toBeInTheDocument();
  });
});
