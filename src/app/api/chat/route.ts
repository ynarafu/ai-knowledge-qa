import { NextRequest } from "next/server";
import { retrieve, buildSystemPrompt } from "@/lib/retrieve";
import { getProvider, getProviderName } from "@/lib/llm";
import type { ChatMessage, Doc, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[]; documents?: Doc[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const messages = body.messages ?? [];
  const documents = body.documents ?? [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  if (!lastUser) {
    return new Response("No user message", { status: 400 });
  }

  // 1) 関連する出典を検索（超軽量RAG）
  const sources = retrieve(documents, lastUser.content, 4);
  const system = buildSystemPrompt(sources);
  const provider = getProvider();

  const encoder = new TextEncoder();
  const send = (
    controller: ReadableStreamDefaultController,
    ev: StreamEvent,
  ) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      // 2) まず出典一覧をクライアントに通知
      send(controller, { type: "sources", sources });

      let full = "";
      try {
        // 3) 選んだバックエンドから回答をストリーミング
        for await (const chunk of provider({ system, messages })) {
          full += chunk;
          send(controller, { type: "delta", text: chunk });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send(controller, { type: "error", message });
      }

      // 4) 回答中に実際に引用された出典番号を抽出
      const cited = [
        ...new Set([...full.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))),
      ];
      send(controller, { type: "done", cited });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-LLM-Provider": getProviderName(),
    },
  });
}
