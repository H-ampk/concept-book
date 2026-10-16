import { useCallback, useEffect, useMemo, useState } from "react";
import { getContextStorage } from "../../storage";
import type { ContextCard, ContextCardInput } from "../../types/contextCard";
import type { ContextCardStorage } from "../../storage/types";

const storage: ContextCardStorage = getContextStorage();

const reloadFailureMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim()
    ? error.message
    : "文脈カードの読み込みに失敗しました。";

export const useContextCards = () => {
  const [contextCards, setContextCards] = useState<ContextCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadError, setReloadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await storage.getAllContextCards();
      setContextCards(all);
      setReloadError(null);
    } catch (error) {
      setReloadError(reloadFailureMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (input: ContextCardInput) => {
      const created = await storage.createContextCard(input);
      await reload();
      return created;
    },
    [reload]
  );

  const update = useCallback(
    async (id: string, updates: Partial<ContextCardInput>) => {
      const updated = await storage.updateContextCard(id, updates);
      await reload();
      return updated;
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await storage.deleteContextCard(id);
      await reload();
    },
    [reload]
  );

  const domains = useMemo(
    () => [...new Set(contextCards.map((card) => card.domainTags[0]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja")),
    [contextCards]
  );

  return {
    contextCards,
    loading,
    reloadError,
    domains,
    reload,
    create,
    update,
    remove
  };
};
