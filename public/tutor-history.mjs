export const legacyThread = "自由答疑";
export const chatPrefix = "sc-chat-";
const threadPattern = /^sc-chat-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export function isChatThread(id) {
  return typeof id === "string" && (id === legacyThread || threadPattern.test(id));
}

export function chatHistory(events) {
  const chats = new Map();
  for (const { kind, data, at } of events) {
    if (!["dialogue", "dialogue-thread"].includes(kind) || !isChatThread(data.thread))
      continue;
    const entry = chats.get(data.thread) ?? {
      id: data.thread,
      title: "新对话",
      first: Infinity,
      last: at,
    };
    if (kind === "dialogue" && at < entry.first) {
      entry.first = at;
      entry.title = chatTitle(data.question);
    }
    entry.last = Math.max(entry.last, at);
    chats.set(entry.id, entry);
  }
  return [...chats.values()].sort((a, b) => b.last - a.last || a.id.localeCompare(b.id));
}

function chatTitle(question) {
  const value = String(question ?? "").replace(/^［附题目截图］\s*/, "").replace(/\s+/g, " ").trim();
  if (!value) return "图片提问";
  return value.length > 45 ? value.slice(0, 45) + "…" : value;
}
