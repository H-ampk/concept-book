import { describe, expect, it } from "vitest";
import { DATA_LAB_DISPLAY_MODE_OPTIONS, type DataLabDisplayMode } from "./dataLabDisplayMode";

describe("DataLabDisplayMode", () => {
  it("histogram は正式な表示形式として扱われる", () => {
    const values = DATA_LAB_DISPLAY_MODE_OPTIONS.map((option) => option.value);
    expect(values).toContain("histogram");
    expect(DATA_LAB_DISPLAY_MODE_OPTIONS.find((option) => option.value === "histogram")?.label).toBe(
      "ヒストグラム"
    );

    const histogram: DataLabDisplayMode = "histogram";
    expect(values).toContain(histogram);
  });
});
