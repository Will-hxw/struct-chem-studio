import {
  studyPage,
  studyPageQuery,
  type StudyRow,
} from "../../../lib/study-page";
import { accountOwner } from "../../../lib/study-account";
import { env } from "cloudflare:workers";
import { checkReadScope, authorizeWrite } from "../../../lib/study-account";
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
    ].includes(event.kind) ||
    typeof event.data !== "object" ||
    !event.data
  )
    return reply({ error: "Invalid event" }, 400);
  if (event.kind === "dialogue") {
    const d = event.data as Record<string, unknown>;
    if (
      typeof d.thread !== "string" ||
      d.thread.length > 240 ||
      typeof d.question !== "string" ||
      d.question.length > 1500 ||
      typeof d.answer !== "string" ||
      d.answer.length > 75000 ||
      typeof d.model !== "string"
    )
      return reply({ error: "对话格式无效。" }, 400);
  }
  const encoded = JSON.stringify(event);
  if (new TextEncoder().encode(encoded).length > 1000000)
    return reply({ error: "Image too large" }, 413);
  await env.DB.prepare(
    "INSERT INTO study_events(owner,event_id,event) VALUES(?,?,?) ON CONFLICT(owner,event_id) DO NOTHING",
  )
    .bind(owner, event.id, encoded)
    .run();
  return reply({ saved: true });
}
