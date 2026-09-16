import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyConceptInput } from "../types/concept";
import { createEmptyContextCardInput } from "../types/contextCard";
import { unzipSync } from "fflate";
import { buildConceptBookZip } from "../utils/conceptBookZip";
import { ContextCardIndexedDBStorage, IndexedDBStorage } from "./indexeddb";

const iso = "2026-01-01T00:00:00.000Z";
const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 1, 2, 3]);
const otherPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x0a, 9, 9]);

const pdfFile = (name = "slide.pdf"): File =>
  new File([pdfBytes], name, { type: "application/pdf" });

const deleteDb = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("concept-book-db");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });

describe("learning materials storage", () => {
  let storage: IndexedDBStorage;
  let contextStorage: ContextCardIndexedDBStorage;

  beforeEach(async () => {
    await deleteDb();
    storage = new IndexedDBStorage();
    contextStorage = new ContextCardIndexedDBStorage();
  });

  afterEach(async () => {
    await deleteDb();
  });

  it("LearningMaterial と PDF Blob を保存・読込できる", async () => {
    const card = await contextStorage.createContextCard({
      ...createEmptyContextCardInput(),
      title: "心理学概論 第4回"
    });
    const material = await storage.addLearningMaterialPdf({
      contextCardId: card.id,
      file: pdfFile("第4回スライド.pdf")
    });
    const loaded = await storage.getLearningMaterial(material.id);
    const blob = await storage.getLearningMaterialBlob(material.id);
    expect(loaded?.fileName).toBe("第4回スライド.pdf");
    expect(loaded?.contextCardId).toBe(card.id);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob && blob.size).toBe(pdfBytes.length);
    const byCard = await storage.getLearningMaterialsByContextCardId(card.id);
    expect(byCard.map((item) => item.id)).toEqual([material.id]);
  });

  it("Anchor を material / concept から取得できる", async () => {
    const concept = await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "強化"
    });
    const card = await contextStorage.createContextCard({
      ...createEmptyContextCardInput(),
      title: "第4回",
      linkedConcepts: [concept.id]
    });
    const material = await storage.addLearningMaterialPdf({
      contextCardId: card.id,
      file: pdfFile()
    });
    await storage.saveConceptSourceAnchor({
      id: "anchor_1",
      materialId: material.id,
      conceptId: concept.id,
      pageIndex: 0,
      rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }],
      quotedText: "ある行動の直後に刺激を提示する",
      createdAt: iso,
      updatedAt: iso
    });
    expect((await storage.getAnchorsByMaterialId(material.id))[0]?.quotedText).toContain("刺激");
    expect((await storage.getAnchorsByConceptId(concept.id))[0]?.id).toBe("anchor_1");
  });

  it("Material削除で Blob と Anchor を消し、無関係データは残す", async () => {
    const concept = await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "強化"
    });
    const card = await contextStorage.createContextCard({
      ...createEmptyContextCardInput(),
      title: "第4回"
    });
    const keepCard = await contextStorage.createContextCard({
      ...createEmptyContextCardInput(),
      title: "残す回"
    });
    const material = await storage.addLearningMaterialPdf({
      contextCardId: card.id,
      file: pdfFile("a.pdf")
    });
    const keepMaterial = await storage.addLearningMaterialPdf({
      contextCardId: keepCard.id,
      file: new File([otherPdfBytes], "b.pdf", { type: "application/pdf" })
    });
    await storage.saveConceptSourceAnchor({
      id: "a1",
      materialId: material.id,
      conceptId: concept.id,
      pageIndex: 0,
      rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }],
      createdAt: iso,
      updatedAt: iso
    });
    await storage.saveConceptSourceAnchor({
      id: "keep",
      materialId: keepMaterial.id,
      conceptId: concept.id,
      pageIndex: 1,
      rects: [{ x: 0.2, y: 0.2, width: 0.2, height: 0.1 }],
      createdAt: iso,
      updatedAt: iso
    });
    await storage.deleteLearningMaterial(material.id);
    expect(await storage.getLearningMaterial(material.id)).toBeUndefined();
    expect(await storage.getLearningMaterialBlob(material.id)).toBeUndefined();
    expect(await storage.getAnchorsByMaterialId(material.id)).toEqual([]);
    expect(await storage.getLearningMaterial(keepMaterial.id)).toBeDefined();
    expect(await storage.getLearningMaterialBlob(keepMaterial.id)).toBeDefined();
    expect((await storage.getAnchorsByMaterialId(keepMaterial.id))[0]?.id).toBe("keep");
  });

  it("ContextCard削除で Material / Blob / Anchor を消し Concept は残す", async () => {
    const concept = await storage.createConcept({
      ...createEmptyConceptInput(),
      title: "弱化"
    });
    const card = await contextStorage.createContextCard({
      ...createEmptyContextCardInput(),
      title: "削除対象"
    });
    const material = await storage.addLearningMaterialPdf({
      contextCardId: card.id,
      file: pdfFile()
    });
    await storage.saveConceptSourceAnchor({
      id: "gone",
      materialId: material.id,
      conceptId: concept.id,
      pageIndex: 0,
      rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }],
      createdAt: iso,
      updatedAt: iso
    });
    await contextStorage.deleteContextCard(card.id);
    expect(await storage.getLearningMaterial(material.id)).toBeUndefined();
    expect(await storage.getLearningMaterialBlob(material.id)).toBeUndefined();
    expect(await storage.getAnchorsByMaterialId(material.id)).toEqual([]);
    expect(await storage.getConceptById(concept.id)).toBeDefined();
  });

  it("Concept削除でその Anchor だけ消す", async () => {
    const a = await storage.createConcept({ ...createEmptyConceptInput(), title: "A" });
    const b = await storage.createConcept({ ...createEmptyConceptInput(), title: "B" });
    const card = await contextStorage.createContextCard({
      ...createEmptyContextCardInput(),
      title: "回"
    });
    const material = await storage.addLearningMaterialPdf({
      contextCardId: card.id,
      file: pdfFile()
    });
    await storage.saveConceptSourceAnchor({
      id: "for-a",
      materialId: material.id,
      conceptId: a.id,
      pageIndex: 0,
      rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.1 }],
      createdAt: iso,
      updatedAt: iso
    });
    await storage.saveConceptSourceAnchor({
      id: "for-b",
      materialId: material.id,
      conceptId: b.id,
      pageIndex: 0,
      rects: [{ x: 0.3, y: 0.3, width: 0.2, height: 0.1 }],
      createdAt: iso,
      updatedAt: iso
    });
    await storage.deleteConcept(a.id);
    expect(await storage.getAnchorsByConceptId(a.id)).toEqual([]);
    expect((await storage.getAnchorsByConceptId(b.id))[0]?.id).toBe("for-b");
    expect(await storage.getLearningMaterial(material.id)).toBeDefined();
  });

  it("ZIP export に PDF が含まれ、import で metadata / blob / anchor が復元される", async () => {
    const concept = await storage.createConcept({ ...createEmptyConceptInput(), title: "強化" });
    const card = await contextStorage.createContextCard({
      ...createEmptyContextCardInput(),
      title: "心理学概論 第4回",
      linkedConcepts: [concept.id]
    });
    const material = await storage.addLearningMaterialPdf({
      contextCardId: card.id,
      file: pdfFile("第4回スライド.pdf")
    });
    await storage.saveConceptSourceAnchor({
      id: "zip-a",
      materialId: material.id,
      conceptId: concept.id,
      pageIndex: 2,
      rects: [{ x: 0.15, y: 0.25, width: 0.4, height: 0.08 }],
      quotedText: "強化とは行動の…",
      createdAt: iso,
      updatedAt: iso
    });
    const zipBlob = await storage.exportConceptBookPackage();
    const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());
    expect(Object.keys(unzipSync(zipBytes))).toContain(`learning-materials/${material.id}.pdf`);

    await storage.deleteLearningMaterial(material.id);
    const zipFile = new File([zipBlob], "backup.zip", { type: "application/zip" });
    const result = await storage.importConceptBookPackage(zipFile, "replace");
    expect(result.importedLearningMaterials).toBe(1);
    expect(result.missingLearningMaterials).toBe(0);
    const restored = await storage.getLearningMaterial(material.id);
    expect(restored?.fileName).toBe("第4回スライド.pdf");
    const blob = await storage.getLearningMaterialBlob(material.id);
    expect(blob && blob.size).toBe(pdfBytes.length);
    const anchors = await storage.getAnchorsByMaterialId(material.id);
    expect(anchors[0]?.quotedText).toBe("強化とは行動の…");
    expect(anchors[0]?.pageIndex).toBe(2);
  });

  it("旧形式ZIPも import 可能", async () => {
    const json = JSON.stringify({
      concepts: [
        {
          id: "c1",
          title: "旧",
          definition: "",
          myInterpretation: "",
          domainTags: [],
          researchTags: [],
          relatedIds: [],
          prerequisiteIds: [],
          source: { book: "", page: "", author: null },
          notes: "",
          status: "draft",
          favorite: false,
          createdAt: iso,
          updatedAt: iso
        }
      ],
      contextCards: []
    });
    const zipped = buildConceptBookZip(json, []);
    const file = new File([new Uint8Array(zipped)], "old.zip", { type: "application/zip" });
    const result = await storage.importConceptBookPackage(file, "replace");
    expect(result.importedConcepts).toBe(1);
    expect(result.importedLearningMaterials).toBe(0);
    expect(await storage.getAllLearningMaterials()).toEqual([]);
  });

  it("JSON replace では PDF blob を復元せず既存教材を消す", async () => {
    const card = await contextStorage.createContextCard({
      ...createEmptyContextCardInput(),
      title: "旧カード"
    });
    const material = await storage.addLearningMaterialPdf({
      contextCardId: card.id,
      file: pdfFile()
    });
    await storage.importBackupData(
      {
        concepts: [],
        contextCards: [],
        quizQuestions: [],
        quizQuestionParseSkipped: 0,
        quizDecks: [],
        quizDeckParseSkipped: 0,
        quizAttemptLogs: [],
        quizAttemptLogParseSkipped: 0,
        researchReports: [],
        researchReportParseSkipped: 0
      },
      "replace"
    );
    expect(await storage.getLearningMaterial(material.id)).toBeUndefined();
    expect(await storage.getLearningMaterialBlob(material.id)).toBeUndefined();
  });
});
