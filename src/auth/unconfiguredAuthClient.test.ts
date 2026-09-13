import { describe, expect, it } from "vitest";
import { createUnconfiguredAuthClient } from "./unconfiguredAuthClient";

describe("createUnconfiguredAuthClient", () => {
  it("currentUser は null で、アプリを throw させない", async () => {
    const client = createUnconfiguredAuthClient();
    expect(client.isConfigured()).toBe(false);
    await expect(client.getCurrentUser()).resolves.toBeNull();
    await expect(client.signOut()).resolves.toBeUndefined();
  });

  it("subscribe は anonymous / unconfigured を返す", () => {
    const client = createUnconfiguredAuthClient();
    const states: unknown[] = [];
    const unsubscribe = client.subscribe((state) => states.push(state));
    expect(states).toEqual([
      { status: "anonymous", user: null, error: null, configured: false }
    ]);
    unsubscribe();
  });
});
