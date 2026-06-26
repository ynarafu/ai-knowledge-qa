export type Role = "user" | "assistant";

export type ChatMessage = {
  role: Role;
  content: string;
};

export type Doc = {
  id: string;
  title: string;
  content: string;
};

// 検索でヒットした出典チャンク。回答中の [n] と対応する。
export type Source = {
  n: number;
  docId: string;
  title: string;
  text: string;
};

// SSE で流すイベント
export type StreamEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done"; cited: number[] };
