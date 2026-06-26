# AI Knowledge Q&A (RAG)

資料を取り込み、**根拠（出典）付きで**答えるRAGチャット。回答はストリーミング表示され、
回答中の `[1]` のような番号が、その根拠となった資料の該当箇所にひも付きます。

## 特徴

- **超軽量RAG**: アップロードした資料を段落チャンクに分割し、質問との用語の重なりで
  関連箇所を検索 → その箇所だけを文脈に渡し、出典番号付きで回答させる
  （外部の埋め込みAPI＝課金を使わずに「出典付き回答」を成立させている）
- **ストリーミング**: Server-Sent Events で回答をトークン単位で逐次表示
- **出典ハイライト**: 回答中の `[n]` をクリックすると該当出典へジャンプ。実際に引用された
  出典は強調表示
- **3つのバックエンドを差し替え可能**（環境変数 `LLM_PROVIDER`）:

  | モード | 用途 | 料金 | 鍵 |
  |---|---|---|---|
  | `mock`   | デモ公開（Vercel等）。サンプル応答 | 無料 | 不要 |
  | `ollama` | ローカルで本物のAIを実行 | 無料 | 不要 |
  | `claude` | Claude API で本番動作 | 従量課金 | 要 |

## 技術スタック

Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS v4 /
`@anthropic-ai/sdk` / Ollama

## セットアップ

```bash
npm install
cp .env.example .env.local   # 必要に応じて編集
npm run dev                  # http://localhost:3001
```

`.env.local` を作らなくても、既定で `mock` モードで動きます（鍵不要）。

### ローカルで本物のAIを動かす（Ollama・無料）

```bash
# 1. https://ollama.com からインストール
# 2. モデルを取得
ollama pull llama3.2
# 3. .env.local で切り替え
#    LLM_PROVIDER=ollama
npm run dev
```

### Claude API を使う場合

`.env.local` に `LLM_PROVIDER=claude` と `ANTHROPIC_API_KEY=...` を設定。
モデルは `CLAUDE_MODEL`（既定 `claude-opus-4-8`）で変更可能。

## デプロイ

`mock` モードのまま Vercel 等にデプロイすれば、鍵もサーバー代も不要で
「触れるデモ」を公開できます（回答はサンプル）。本物のAI体験はローカルの
Ollama モードで動かし、その様子を動画で紹介する運用を想定しています。

## 構成

```
src/
  app/
    api/chat/route.ts   # SSEストリーミングのエンドポイント
    page.tsx, layout.tsx
  components/Chat.tsx    # チャットUI（資料パネル・出典表示）
  lib/
    retrieve.ts         # チャンク分割＋検索＋システムプロンプト生成
    llm/
      index.ts          # バックエンド選択
      mock.ts / ollama.ts / claude.ts
    sampleDocs.ts, types.ts
```
