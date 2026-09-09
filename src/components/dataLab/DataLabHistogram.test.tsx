import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataLabHistogram } from "./DataLabHistogram";

describe("DataLabHistogram", () => {
  it("ヒストグラムを描画する", () => {
    render(
      <DataLabHistogram
        bins={[
          { min: 0, max: 0.5, count: 3, label: "0%〜50%", maxInclusive: false },
          { min: 0.5, max: 1, count: 5, label: "50%〜100%", maxInclusive: true }
        ]}
        metric="accuracy"
        groupBy="concept"
      />
    );
    expect(screen.getByTestId("data-lab-histogram")).toBeInTheDocument();
  });
});
