import { useCallback, useEffect, useState } from "react";
import { getStorage } from "../../storage";
import type { ConceptSourceAnchor } from "../../types/conceptSourceAnchor";
import type { LearningMaterial } from "../../types/learningMaterial";

const storage = getStorage();

export const useLearningMaterials = (contextCardId: string | undefined) => {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!contextCardId) {
      setMaterials([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMaterials(await storage.getLearningMaterialsByContextCardId(contextCardId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "教材の読み込みに失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [contextCardId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addPdf = useCallback(
    async (file: File, title?: string) => {
      if (!contextCardId) {
        throw new Error("文脈カードが選択されていません。");
      }
      const created = await storage.addLearningMaterialPdf({ contextCardId, file, title });
      await reload();
      return created;
    },
    [contextCardId, reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await storage.deleteLearningMaterial(id);
      await reload();
    },
    [reload]
  );

  return { materials, loading, error, reload, addPdf, remove };
};

export const useMaterialAnchors = (materialId: string | undefined) => {
  const [anchors, setAnchors] = useState<ConceptSourceAnchor[]>([]);
  const reload = useCallback(async () => {
    setAnchors(materialId ? await storage.getAnchorsByMaterialId(materialId) : []);
  }, [materialId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { anchors, reload };
};
