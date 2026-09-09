import { AIError } from "../errors";
import type { AIEmbeddingProvider } from "../types";
import { OllamaClient } from "./ollamaClient";

export type OllamaEmbeddingProviderOptions = {
  baseUrl: string;
  model: string;
  enabled: boolean;
};

export class OllamaEmbeddingProvider implements AIEmbeddingProvider {
  private readonly client: OllamaClient;
  private readonly model: string;
  private readonly enabled: boolean;

  constructor(options: OllamaEmbeddingProviderOptions) {
    this.client = new OllamaClient(options.baseUrl);
    this.model = options.model;
    this.enabled = options.enabled;
  }

  async embed(input: string | string[]): Promise<number[][]> {
    if (!this.enabled) {
      throw new AIError("disabled", "AI機能が無効です。設定からローカルAIを有効にしてください。");
    }
    return this.client.embed(this.model, input);
  }
}
