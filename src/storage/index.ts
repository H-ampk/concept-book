import { IndexedDBStorage } from "./indexeddb";
import type { ConceptStorage } from "./types";

let storageInstance: ConceptStorage | null = null;

export const getStorage = (): ConceptStorage => {
  if (!storageInstance) {
    storageInstance = new IndexedDBStorage();
  }
  return storageInstance;
};
