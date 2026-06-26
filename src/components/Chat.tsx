"use client";

import { useRef, useState } from "react";
import type { Doc, Source, StreamEvent } from "@/lib/types";
import { sampleDocs } from "@/lib/sampleDocs";

type Msg = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  cited?: number[];
  error?: boolean;
};

// 回答テキスト中の [n] を、出典にスクロールするチップに変換して描画
function renderAnswer(
  content: string,
  sources: Source[] | undefined,
  sourceIdPrefix: string,
) {
  const known = new Set((sources ?? []).map((s) => s.n));
  const parts = content.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m && known.has(Number(m[1]))) {
      const n = Number(m[1]);
      return (
        <sup key={i}>
          <a
            href={`#${sourceIdPrefix}-${n}`}
            className="mx-0.5 rounded bg-[var(--color-accent)]/15 px-1 py-0.5 text-[10px] font-semibold text-[var(--color-accent)] no-underline hover:bg-[var(--color-accent)]/30"
          >
            {n}
          </a>
        </sup>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function Chat() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docText, setDocText] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  function addDoc(title: string, content: string) {
    const t = title.trim() || "無題の資料";
    if (!content.trim()) return;
    setDocs((d) => [
      ...d,
      { id: crypto.randomUUID(), title: t, content: content.trim() },
    ]);
  }

  function onAddManual() {
    addDoc(docTitle, docText);
    setDocTitle("");
    setDocText("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const f of Array.from(files)) {
      const text = await f.text();
      addDoc(f.name, text);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function loadSamples() {
    setDocs((d) => {
      const ids = new Set(d.map((x) => x.id));
      return [...d, ...sampleDocs.filter((s) => !ids.has(s.id))];
    });
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);

    const history: Msg[] = [...messages, { role: "user", content: q }];
    // assistant プレースホルダ
    setMessages([...history, { role: "assistant", content: "" }]);
    scrollToBottom();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          documents: docs,
        }),
      });
      if (!res.body) throw new Error("ストリームを取得できませんでした");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const update = (patch: Partial<Msg>) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, ...patch };
          return next;
        });
      const appendText = (t: string) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + t };
          return next;
        });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) >= 0) {
          const raw = buffer.slice(0, sep).trim();
          buffer = buffer.slice(sep + 2);
          if (!raw.startsWith("data:")) continue;
          const ev = JSON.parse(raw.slice(5).trim()) as StreamEvent;
          if (ev.type === "sources") update({ sources: ev.sources });
          else if (ev.type === "delta") appendText(ev.text);
          else if (ev.type === "error")
            update({ content: `⚠️ ${ev.message}`, error: true });
          else if (ev.type === "done") update({ cited: ev.cited });
          scrollToBottom();
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `⚠️ ${message}`,
          error: true,
        };
        return next;
      });
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  return (
    <div className="mx-auto flex h-dvh max-w-6xl flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <h1 className="font-mono text-lg font-semibold">
          <span className="text-[var(--color-accent)]">&gt;_</span> AI Knowledge
          Q&amp;A
        </h1>
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1 font-mono text-xs text-[var(--color-muted)]">
          RAG · 出典付き回答
        </span>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden pb-4 md:grid-cols-[320px_1fr]">
        {/* 資料パネル */}
        <aside className="flex min-h-0 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold text-[var(--color-accent-2)]">
              資料 ({docs.length})
            </h2>
            <button
              onClick={loadSamples}
              className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
            >
              サンプルを読み込む
            </button>
          </div>

          <div className="mb-3 space-y-2">
            <input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="資料のタイトル"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="本文を貼り付け…"
              rows={4}
              className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <div className="flex gap-2">
              <button
                onClick={onAddManual}
                className="flex-1 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[#04110d]"
              >
                追加
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:border-[var(--color-accent)]"
              >
                ファイル
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.markdown,text/*"
                multiple
                onChange={onFile}
                className="hidden"
              />
            </div>
          </div>

          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-2 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{d.title}</p>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {d.content.length.toLocaleString()} 文字
                  </p>
                </div>
                <button
                  onClick={() =>
                    setDocs((arr) => arr.filter((x) => x.id !== d.id))
                  }
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                  aria-label="削除"
                >
                  ✕
                </button>
              </li>
            ))}
            {docs.length === 0 && (
              <li className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-xs text-[var(--color-muted)]">
                資料を追加するか
                <br />
                「サンプルを読み込む」を押してください
              </li>
            )}
          </ul>
        </aside>

        {/* チャット */}
        <main className="flex min-h-0 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-sm text-[var(--color-muted)]">
                <p className="mb-1 text-base text-[var(--color-fg)]">
                  資料について質問してみましょう
                </p>
                <p>
                  例:「リモートワークは週何日まで？」「データの保持期間は？」
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--color-accent)] px-4 py-2.5 text-sm text-[#04110d]"
                      : `max-w-[90%] rounded-2xl rounded-bl-sm border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-4 py-3 text-sm leading-relaxed ${
                          m.error ? "text-red-300" : ""
                        }`
                  }
                >
                  {m.role === "assistant" ? (
                    <>
                      <div className="whitespace-pre-wrap">
                        {renderAnswer(m.content, m.sources, `msg-${i}-src`)}
                        {loading && i === messages.length - 1 && !m.content && (
                          <span className="cursor-blink text-[var(--color-muted)]">
                            考えています
                          </span>
                        )}
                      </div>

                      {/* 出典 */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                          <p className="mb-2 font-mono text-xs text-[var(--color-muted)]">
                            出典
                          </p>
                          <ul className="space-y-2">
                            {m.sources.map((s) => {
                              const used = m.cited?.includes(s.n);
                              return (
                                <li
                                  key={s.n}
                                  id={`msg-${i}-src-${s.n}`}
                                  className={`rounded-md border px-3 py-2 text-xs ${
                                    used
                                      ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5"
                                      : "border-[var(--color-border)] opacity-60"
                                  }`}
                                >
                                  <span className="mr-1 font-semibold text-[var(--color-accent)]">
                                    [{s.n}]
                                  </span>
                                  <span className="text-[var(--color-accent-2)]">
                                    {s.title}
                                  </span>
                                  <p className="mt-1 line-clamp-3 text-[var(--color-muted)]">
                                    {s.text}
                                  </p>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 入力 */}
          <div className="border-t border-[var(--color-border)] p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={
                  docs.length === 0
                    ? "まず左で資料を追加してください…"
                    : "資料について質問する…"
                }
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#04110d] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "…" : "送信"}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
