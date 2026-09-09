export type AIMessageRole = "system" | "user" | "assistant";

export type AIMessage = {
  role: AIMessageRole;
  content: string;
};

export type AITextRequest = {
  messages: AIMessage[];
};

export type AITextResponse = {
  text: string;
};

export interface AITextProvider {
  generate(request: AITextRequest): Promise<AITextResponse>;
}

export interface AIEmbeddingProvider {
  embed(input: string | string[]): Promise<number[][]>;
}

export const AI_PROVIDER_KIND = "ollama" as const;

export type AIProviderKind = typeof AI_PROVIDER_KIND;

export type AISettings = {
  enabled: boolean;
  provider: AIProviderKind;
  baseUrl: string;
  textModel: string;
  embeddingModel: string;
};
