import { describe, expect, it, vi } from "vitest";
import { stripAuthCallbackFromLocation } from "./stripAuthCallbackUrl";

describe("stripAuthCallbackFromLocation", () => {
  it("PKCE の code / state を URL から除く", () => {
    const replaceState = vi.fn();
    stripAuthCallbackFromLocation(
      "https://h-ampk.github.io/concept-book/?code=abc&state=xyz&keep=1",
      replaceState
    );
    expect(replaceState).toHaveBeenCalledWith("/concept-book/?keep=1");
  });

  it("implicit の hash token を除く", () => {
    const replaceState = vi.fn();
    stripAuthCallbackFromLocation(
      "https://h-ampk.github.io/concept-book/#access_token=tok&refresh_token=ref",
      replaceState
    );
    expect(replaceState).toHaveBeenCalledWith("/concept-book/");
  });

  it("認証 callback が無ければ URL を変えない", () => {
    const replaceState = vi.fn();
    stripAuthCallbackFromLocation("https://h-ampk.github.io/concept-book/", replaceState);
    expect(replaceState).not.toHaveBeenCalled();
  });
});
