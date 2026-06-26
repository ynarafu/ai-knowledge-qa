import type { LLMInput } from "./index";

// ローカルのOllamaで本物のAIを動かすバックエンド（鍵不要・無料）。
// 事前に `ollama pull <model>` でモデルを取得し、Ollamaを起動しておくこと。
export async function* streamOllama(input: LLMInput): AsyncIterable<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: "system", content: input.system },
          ...input.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
  } catch {
    throw new Error(
      `Ollama に接続できませんでした (${baseUrl})。Ollama を起動し、\`ollama pull ${model}\` でモデルを取得してください。`,
    );
  }

  if (!res.ok || !res.body) {
    throw new Error(`Ollama がエラーを返しました: HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Ollama は NDJSON（1行=1 JSON）でストリームする
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const json = JSON.parse(line);
        const piece: string | undefined = json?.message?.content;
        if (piece) yield piece;
      } catch {
        // 不完全な行は無視
      }
    }
  }
}
