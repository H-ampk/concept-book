import { useCallback, useEffect, useState } from "react";
import { getStorage } from "../../storage";
import type { Concept } from "../../types/concept";
import type { QuizAttemptLog, QuizDeck } from "../../types/quiz";
import { DataLabView } from "./DataLabView";

const storage = getStorage();

type Props = {
  onBack: () => void;
  onGoToQuizPlay?: () => void;
};

export const DataLabPage = ({ onBack, onGoToQuizPlay }: Props) => {
  const [logs, setLogs] = useState<QuizAttemptLog[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [decks, setDecks] = useState<QuizDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [allLogs, allConcepts, allDecks] = await Promise.all([
        storage.getQuizAttemptLogs(),
        storage.getAllConcepts(),
        storage.getQuizDecks()
      ]);
      setLogs(allLogs);
      setConcepts(allConcepts);
      setDecks(allDecks);
    } catch {
      setLogs([]);
      setConcepts([]);
      setDecks([]);
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
      logs={logs}
      concepts={concepts}
      decks={decks}
      loading={loading}
      error={error}
      onBack={onBack}
      onGoToQuizPlay={onGoToQuizPlay}
    />
  );
};
