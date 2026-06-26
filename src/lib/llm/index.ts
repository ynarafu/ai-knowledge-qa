import type { ChatMessage } from "../types";
import { streamMock } from "./mock";
import { streamOllama } from "./ollama";
import { streamClaude } from "./claude";

export type LLMInput = {
  system: string;
  messages: ChatMessage[];
};

export type LLMProvider = (input: LLMInput) => AsyncIterable<string>;

export function getProviderName(): "mock" | "ollama" | "claude" {
  const p = (process.env.LLM_PROVIDER ?? "mock").toLowerCase();
  if (p === "ollama" || p === "claude") return p;
  return "mock";
}

// 環境変数 LLM_PROVIDER でバックエンドを切り替える。
// mock=Vercel公開用 / ollama=ローカル本番 / claude=Claude API
export function getProvider(): LLMProvider {
  switch (getProviderName()) {
    case "ollama":
      return streamOllama;
    case "claude":
      return streamClaude;
    default:
      return streamMock;
  }
}
