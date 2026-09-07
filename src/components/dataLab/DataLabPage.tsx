import { useCallback, useEffect, useState } from "react";
import { getStorage } from "../../storage";
import type { QuizAttemptLog } from "../../types/quiz";
import { DataLabView } from "./DataLabView";

const storage = getStorage();

type Props = {
  onBack: () => void;
  onGoToQuizPlay?: () => void;
};

export const DataLabPage = ({ onBack, onGoToQuizPlay }: Props) => {
  const [logs, setLogs] = useState<QuizAttemptLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const allLogs = await storage.getQuizAttemptLogs();
      setLogs(allLogs);
    } catch {
      setLogs([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DataLabView
      logCount={logs.length}
      loading={loading}
      error={error}
      onBack={onBack}
      onGoToQuizPlay={onGoToQuizPlay}
    />
  );
};
