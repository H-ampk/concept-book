import { ContextCardIndexedDBStorage, IndexedDBStorage } from "./indexeddb";
import type { ConceptStorage, ContextCardStorage } from "./types";

let storageInstance: ConceptStorage | null = null;
let contextStorageInstance: ContextCardStorage | null = null;

export const getStorage = (): ConceptStorage => {
  if (!storageInstance) {
    storageInstance = new IndexedDBStorage();
  }
  return storageInstance;
};

export const getContextStorage = (): ContextCardStorage => {
  if (!contextStorageInstance) {
    contextStorageInstance = new ContextCardIndexedDBStorage();
  }
  return contextStorageInstance;
};
