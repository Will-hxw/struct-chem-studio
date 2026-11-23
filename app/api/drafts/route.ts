import { env } from "cloudflare:workers";
import {
  checkReadScope,
  accountOwner,
  accountReply,
  authorizeWrite,
} from "../../../lib/study-account";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const owner = await accountOwner(req);
  if (!owner) return accountReply({ error: "请先登录。" }, 401);
  const denied = await checkReadScope(req, owner);
  if (denied) return denied;
  if (!env.DB) return accountReply({ error: "数据库暂时无法连接。" }, 503);
  const rows = await env.DB.prepare(
    "SELECT kind,version,body FROM study_drafts WHERE owner=?",
  )
    .bind(owner)
    .all<{ kind: string; version: number; body: string }>();
  return accountReply({
    drafts: rows.results.map((r) => ({
      kind: r.kind,
      version: r.version,
      data: JSON.parse(r.body),
    })),
  });
}
export async function PUT(req: Request) {
  const owner = await accountOwner(req);
  if (!owner) return accountReply({ error: "请先登录。" }, 401);
  const denied = await authorizeWrite(req, owner);
  if (denied) return denied;
  if (!env.DB) return accountReply({ error: "数据库暂时无法连接。" }, 503);
  const v = (await req.json().catch(() => null)) as {
    kind?: string;
    base?: number;
    data?: unknown;
  } | null;
  if (
    !v ||
    !["round", "exam"].includes(v.kind || "") ||
    !Number.isSafeInteger(v.base) ||
    (v.base as number) < 0 ||
    !("data" in v) ||
    (v.data !== null && (typeof v.data !== "object" || Array.isArray(v.data)))
  )
    return accountReply({ error: "进度格式无效。" }, 400);
  const body = JSON.stringify(v.data);
  if (new TextEncoder().encode(body).length > 850000)
    return accountReply({ error: "进度内容过长。" }, 413);
  const write =
    v.base === 0
      ? env.DB.prepare(
          "INSERT INTO study_drafts(owner,kind,version,body) VALUES(?,?,1,?) ON CONFLICT(owner,kind) DO NOTHING",
        ).bind(owner, v.kind, body)
      : env.DB.prepare(
          "UPDATE study_drafts SET body=?,version=version+1 WHERE owner=? AND kind=? AND version=?",
        ).bind(body, owner, v.kind, v.base);
  const out = await write.run();
  if (!out.meta.changes)
    return accountReply(
      {
        conflict: true,
        error: "另一台设备已更新本轮进度。刷新后可继续最新进度。",
      },
      409,
    );
  return accountReply({ version: (v.base as number) + 1 });
}
