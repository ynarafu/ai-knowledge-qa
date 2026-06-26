import type { Doc, Source } from "./types";

// ── 超軽量RAGの検索パート ───────────────────────────────────────
// 外部の埋め込みAPI（=課金）を使わず、用語の重なりだけで関連チャンクを選ぶ。
// 本格運用ではベクトル検索に差し替え可能だが、鍵ゼロ・無料で「出典付き回答」を成立させる。

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "is", "are", "was", "were",
  "for", "on", "with", "as", "by", "at", "it", "this", "that", "be", "から",
  "こと", "もの", "ため", "です", "ます", "して", "する", "した", "ある", "いる",
  "の", "に", "は", "を", "が", "と", "も", "で", "や", "へ",
]);

function tokenize(text: string): string[] {
  // 英数字の語 + 日本語2gram（簡易）でトークン化
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z0-9]+/g) ?? [];
  const jp = lower.match(/[぀-ヿ一-龯]+/g) ?? [];
  const bigrams: string[] = [];
  for (const run of jp) {
    if (run.length === 1) bigrams.push(run);
    for (let i = 0; i < run.length - 1; i++) bigrams.push(run.slice(i, i + 2));
  }
  return [...words, ...bigrams].filter((t) => !STOPWORDS.has(t));
}

// ドキュメントを段落チャンクに分割
function chunk(doc: Doc): { docId: string; title: string; text: string }[] {
  return doc.content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((text) => ({ docId: doc.id, title: doc.title, text }));
}

// 質問に関連するチャンクを上位 topK 件返す
export function retrieve(docs: Doc[], question: string, topK = 4): Source[] {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return [];

  const chunks = docs.flatMap(chunk);
  const scored = chunks.map((c) => {
    const cTokens = tokenize(c.text);
    let hits = 0;
    for (const t of cTokens) if (qTokens.has(t)) hits++;
    // 長さで正規化（長文が有利になりすぎないように）
    const score = hits / Math.sqrt(cTokens.length + 1);
    return { c, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s, i) => ({
      n: i + 1,
      docId: s.c.docId,
      title: s.c.title,
      text: s.c.text,
    }));
}

// 出典を埋め込んだシステムプロンプトを組み立てる
export function buildSystemPrompt(sources: Source[]): string {
  if (sources.length === 0) {
    return [
      "あなたは資料に基づいて答えるアシスタントです。",
      "今回、質問に関連する資料が見つかりませんでした。",
      "その場合は推測せず「提供された資料には該当する情報が見つかりませんでした」と答えてください。",
    ].join("\n");
  }
  const ctx = sources
    .map((s) => `[${s.n}] (出典: ${s.title})\n${s.text}`)
    .join("\n\n");
  return [
    "あなたは、与えられた資料だけに基づいて日本語で回答するアシスタントです。",
    "回答の根拠となった箇所には必ず [1] のように出典番号を付けてください（複数可）。",
    "資料に書かれていないことは推測せず、その旨を述べてください。簡潔に答えてください。",
    "",
    "=== 資料 ===",
    ctx,
    "=== 資料ここまで ===",
  ].join("\n");
}
