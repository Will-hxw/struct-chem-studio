import {
  studyPage,
  studyPageQuery,
  type StudyRow,
} from "../../../lib/study-page";
import { accountOwner } from "../../../lib/study-account";
import { env } from "cloudflare:workers";
import { checkReadScope, authorizeWrite } from "../../../lib/study-account";
import { isChatThread, legacyThread } from "../../../public/tutor-history.mjs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
export async function GET(req: Request) {
  const owner = await accountOwner(req);
  if (!owner) return reply({ error: "请先登录。" }, 401);
  const denied = await checkReadScope(req, owner);
  if (denied) return denied;
  if (!env.DB) return reply({ error: "Database offline" }, 503);
  const cursor = Number(new URL(req.url).searchParams.get("cursor") || 0);
  if (!Number.isSafeInteger(cursor) || cursor < 0)
    return reply({ error: "Invalid cursor" }, 400);
  const rows = await studyPageQuery(env.DB, owner, cursor).all<StudyRow>();
  return reply(studyPage(rows.results, cursor));
}
export async function POST(req: Request) {
  const owner = await accountOwner(req);
  if (!owner) return reply({ error: "请先登录。" }, 401);
  if (!env.DB) return reply({ error: "Database offline" }, 503);
  const denied = await authorizeWrite(req, owner);
  if (denied) return denied;
  const raw: unknown = await req.json().catch(() => null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return reply({ error: "Invalid event" }, 400);
  const event = raw as Record<string, unknown>;
  if (
    !event ||
    typeof event.id !== "string" ||
    !/^[a-zA-Z0-9-]{8,88}$/.test(event.id) ||
    !Number.isSafeInteger(event.at) ||
    typeof event.kind !== "string" ||
    ![
      "question",
      "attempt",
      "favorite",
      "goal",
      "reason",
      "exam",
      "dialogue",
      "dialogue-thread",
      "dialogue-delete",
    ].includes(event.kind) ||
    typeof event.data !== "object" ||
    !event.data
  )
    return reply({ error: "Invalid event" }, 400);
  const data = event.data as Record<string, unknown>;
  if (event.kind === "dialogue-delete") {
    if (
      !Array.isArray(data.threads) ||
      !data.threads.length ||
      !data.threads.every(isChatThread)
    )
      return reply({ error: "请选择要删除的对话。" }, 400);
    if (JSON.stringify(data.threads).length > 250000)
      return reply({ error: "本次选择的对话过多，请分批删除。" }, 413);
    return deleteChats(env.DB, owner, event.id, [...new Set(data.threads)]);
  }
  if (
    event.kind === "dialogue-thread" &&
    (!isChatThread(data.thread) || data.thread === legacyThread)
  )
    return reply({ error: "对话格式无效。" }, 400);
  if (event.kind === "dialogue") {
    if (
      typeof data.thread !== "string" ||
      data.thread.length > 240 ||
      typeof data.question !== "string" ||
      data.question.length > 1500 ||
      typeof data.answer !== "string" ||
      data.answer.length > 75000 ||
      typeof data.model !== "string"
    )
      return reply({ error: "对话格式无效。" }, 400);
  }
  const encoded = JSON.stringify(event);
  if (new TextEncoder().encode(encoded).length > 1000000)
    return reply({ error: "Image too large" }, 413);
  if (
    (event.kind === "dialogue" || event.kind === "dialogue-thread") &&
    isChatThread(data.thread)
  ) {
    const [write, previous] = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO study_events(owner,event_id,event) SELECT ?,?,? WHERE NOT EXISTS " +
          "(SELECT 1 FROM study_events s, json_each(s.event,'$.data.threads') t " +
          "WHERE s.owner=? AND json_extract(s.event,'$.kind')='dialogue-delete' AND t.value=?) " +
          "ON CONFLICT(owner,event_id) DO NOTHING",
      ).bind(owner, event.id, encoded, owner, data.thread),
      env.DB.prepare("SELECT seq FROM study_events WHERE owner=? AND event_id=?")
        .bind(owner, event.id),
    ]);
    if (!write.meta.changes && !previous.results.length)
      return reply({ conflict: true, error: "这段对话已被删除，请打开其他对话。" }, 409);
    return reply({ saved: true });
  }
  await env.DB.prepare(
    "INSERT INTO study_events(owner,event_id,event) VALUES(?,?,?) ON CONFLICT(owner,event_id) DO NOTHING",
  )
    .bind(owner, event.id, encoded)
    .run();
  return reply({ saved: true });
}

async function deleteChats(db: D1Database, owner: string, id: string, threads: string[]) {
  const event = { kind: "dialogue-delete", id, at: Date.now(), data: { threads } };
  const [, , marker] = await db.batch<StudyRow>([
    db.prepare(
      "DELETE FROM study_events WHERE owner=? AND json_extract(event,'$.kind') IN ('dialogue','dialogue-thread') " +
      "AND json_extract(event,'$.data.thread') IN (SELECT value FROM json_each(?)) " +
      "AND NOT EXISTS (SELECT 1 FROM study_events WHERE owner=? AND event_id=?)",
    ).bind(owner, JSON.stringify(threads), owner, id),
    db.prepare(
      "INSERT INTO study_events(owner,event_id,event) VALUES(?,?,?) ON CONFLICT(owner,event_id) DO NOTHING",
    ).bind(owner, id, JSON.stringify(event)),
    db.prepare("SELECT seq,event FROM study_events WHERE owner=? AND event_id=?")
      .bind(owner, id),
  ]);
  const row = marker.results[0];
  const recorded = JSON.parse(row.event);
  if (recorded.kind !== "dialogue-delete")
    return reply({ conflict: true, error: "删除请求已失效，请重试。" }, 409);
  return reply({ saved: true, event: recorded });
}
