import type { BackupExportData, BackupExportOptions } from "./types";

/**
 * バックアップ本体の形式は変えず、学習ログ除外時のみ quizAttemptLogs を空配列にする。
 * オプション省略・true は完全バックアップ（後方互換）。
 */
export const applyBackupExportOptions = (
  data: BackupExportData,
  options?: BackupExportOptions
): BackupExportData => {
  if (options?.includeQuizAttemptLogs === false) {
    return { ...data, quizAttemptLogs: [] };
  }
  return data;
};
