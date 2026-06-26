import type { LLMInput } from "./index";

// 鍵不要のモックバックエンド（Vercel公開用）。
// 実際のLLMは呼ばず、システムプロンプト内の資料([n])を使って
// それらしい「出典付き回答」をストリーミング風に返す。
// ※ これはデモ用のサンプル応答です。本物のAI推論はOllama/Claudeモードで行います。

function buildMockAnswer(system: string, question: string): string {
  // system プロンプトから資料番号を拾う
  const nums = [...system.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  const unique = [...new Set(nums)];

  if (unique.length === 0) {
    return "提供された資料には、ご質問に該当する情報が見つかりませんでした。資料を追加してから、もう一度お試しください。\n\n（これはデモモードのサンプル応答です。）";
  }

  const cites = unique.slice(0, 2).map((n) => `[${n}]`).join("");
  return (
    `ご質問「${question.slice(0, 40)}${question.length > 40 ? "…" : ""}」について、` +
    `アップロードされた資料を参照して回答します。${cites} に記載の内容が根拠です。` +
    `資料の該当箇所に基づくと、要点は次のとおりです。${cites}\n\n` +
    `より詳しい本物の回答は、ローカルのOllama（または Claude API）モードで生成されます。` +
    `（これはデモモードのサンプル応答です。）`
  );
}

export async function* streamMock(input: LLMInput): AsyncIterable<string> {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const answer = buildMockAnswer(input.system, lastUser?.content ?? "");

  // タイプライター風に少しずつ流す
  const tokens = answer.match(/[\s\S]{1,3}/g) ?? [answer];
  for (const t of tokens) {
    await new Promise((r) => setTimeout(r, 18));
    yield t;
  }
}
