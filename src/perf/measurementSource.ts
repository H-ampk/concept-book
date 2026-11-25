/** 内容差分または未追跡ファイルがあるときだけ計測を止める。status 表示だけでは止めない。 */
export const sourceContentDiffersFromHead = (input: {
  diff: string;
  rawDiff: string;
  untracked: string;
}): boolean =>
  input.diff.trim().length > 0 || input.rawDiff.trim().length > 0 || input.untracked.trim().length > 0;

/** 直下と environment のどちらに識別子があっても、記録済みの結果とみなす。 */
export const hasMeasuredSourceCommit = (parsed: unknown): boolean => {
  if (!parsed || typeof parsed !== "object") {
    return false;
  }
  const record = parsed as {
    measuredSourceCommit?: unknown;
    environment?: { measuredSourceCommit?: unknown };
  };
  return (
    (typeof record.measuredSourceCommit === "string" && record.measuredSourceCommit.length > 0) ||
    (typeof record.environment?.measuredSourceCommit === "string" &&
      record.environment.measuredSourceCommit.length > 0)
  );
};
