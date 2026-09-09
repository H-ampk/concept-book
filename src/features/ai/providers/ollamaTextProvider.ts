import { AIError } from "../errors";
import type { AITextProvider, AITextRequest, AITextResponse } from "../types";
import { OllamaClient } from "./ollamaClient";

export type OllamaTextProviderOptions = {
  baseUrl: string;
  model: string;
  enabled: boolean;
};

export class OllamaTextProvider implements AITextProvider {
  private readonly client: OllamaClient;
  private readonly model: string;
  private readonly enabled: boolean;

  constructor(options: OllamaTextProviderOptions) {
    this.client = new OllamaClient(options.baseUrl);
    this.model = options.model;
    this.enabled = options.enabled;
  }

  async generate(request: AITextRequest): Promise<AITextResponse> {
    if (!this.enabled) {
      throw new AIError("disabled", "AI機能が無効です。設定からローカルAIを有効にしてください。");
    }
    const text = await this.client.chat(this.model, request.messages);
    return { text };
  }
}
