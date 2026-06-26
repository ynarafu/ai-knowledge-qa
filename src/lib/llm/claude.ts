import Anthropic from "@anthropic-ai/sdk";
import type { LLMInput } from "./index";

// Claude API バックエンド（ANTHROPIC_API_KEY が必要）。
// 鍵があればこのモードで本番動作する。鍵が無ければ mock / ollama を使う。
export async function* streamClaude(input: LLMInput): AsyncIterable<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY が未設定です。LLM_PROVIDER=ollama または mock をご利用ください。",
    );
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";

  // 長めの回答でもタイムアウトしないようストリーミングを使用
  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: input.system,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
