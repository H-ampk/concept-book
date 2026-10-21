import { describe, expect, it, vi } from "vitest";
import {
  JSON_IMPORT_TOO_LARGE_MESSAGE,
  readJsonBackupPayload
} from "./importResourceLimits";

const jsonFile = (contents: string, name = "backup.json"): File =>
  new File([contents], name, { type: "application/json" });

describe("readJsonBackupPayload", () => {
  it("正常なJSONを解析する", async () => {
    await expect(readJsonBackupPayload(jsonFile('{"concepts":[]}'))).resolves.toEqual({ concepts: [] });
  });

  it("上限ちょうどのJSONを受け入れる", async () => {
    const contents = '{"concepts":[]}';
    const file = jsonFile(contents);
    await expect(readJsonBackupPayload(file, { maxJsonBytes: file.size })).resolves.toEqual({
      concepts: []
    });
  });

  it("file.size が上限を超えると file.text() も JSON.parse も呼ばない", async () => {
    const contents = '{"concepts":[]}';
    const file = jsonFile(contents);
    Object.defineProperty(file, "size", { value: contents.length + 1 });
    const text = vi.spyOn(file, "text");
    const parse = vi.spyOn(JSON, "parse");

    await expect(readJsonBackupPayload(file, { maxJsonBytes: contents.length })).rejects.toThrow(
      JSON_IMPORT_TOO_LARGE_MESSAGE
    );
    expect(text).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("読んだ本文が上限を超えると JSON.parse の前に拒否する", async () => {
    const file = jsonFile("{}");
    vi.spyOn(file, "text").mockResolvedValue("x".repeat(32));
    const parse = vi.spyOn(JSON, "parse");

    await expect(readJsonBackupPayload(file, { maxJsonBytes: 16 })).rejects.toThrow(
      JSON_IMPORT_TOO_LARGE_MESSAGE
    );
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it("不正なJSONは SyntaxError になり、容量超過とは別の失敗になる", async () => {
    await expect(readJsonBackupPayload(jsonFile("{"))).rejects.toBeInstanceOf(SyntaxError);
  });
});
