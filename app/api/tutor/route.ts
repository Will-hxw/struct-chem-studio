import { accountOwner } from "../../../lib/study-account";
import { env } from "cloudflare:workers";
import { available, readInput, tutorResponse } from "../../../lib/chem-tutor";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
export async function GET(req: Request) {
  if (!(await accountOwner(req))) return reply({ error: "请先登录。" }, 401);
  return reply({
    authenticated: true,
    models: available(env),
  });
}
async function readBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let size = 0,
    s = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4250000) {
        await reader.cancel();
        throw new RangeError();
      }
      s += decoder.decode(value, { stream: true });
    }
    return JSON.parse(s + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}
export async function POST(req: Request) {
  const owner = await accountOwner(req);
  if (!owner) return reply({ error: "请先登录账号，再使用 AI 答疑。" }, 401);
  if (
    (req.headers.has("Origin") &&
      req.headers.get("Origin") !== new URL(req.url).origin) ||
    req.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    return reply({ error: "请从本站打开助教。" }, 403);
  if (!req.headers.get("Content-Type")?.startsWith("application/json"))
    return reply({ error: "请求格式不正确。" }, 415);
  let raw;
  try {
    raw = await readBody(req);
  } catch (e) {
    return reply(
      {
        error:
          e instanceof RangeError
            ? "图片或文字过大，请裁剪图片或缩短提问。"
            : "请求格式不正确。",
      },
      e instanceof RangeError ? 413 : 400,
    );
  }
  const input = readInput(raw);
  if (!input)
    return reply(
      {
        error:
          raw?.image !== undefined
            ? "请使用 3 MB 以内的 PNG、JPEG 或 WebP 图片，并检查提问内容。"
            : "请选择已支持的模型并输入问题。",
      },
      400,
    );
  const ready = available(env);
  if (
    input.image &&
    !ready.some(
      (m) => m.vision && (input.model === "auto" || m.id === input.model),
    )
  )
    return reply({ error: "所选模型无法读图，请选择支持图片的模型。" }, 400);
  if (
    !ready.length ||
    (input.model !== "auto" && !ready.some((m) => m.id === input.model))
  )
    return reply({ error: "所选模型尚未连接。" }, 503);
  if (!env.DB) return reply({ error: "助教暂时离线，题库解析仍可查看。" }, 503);
  const now = Date.now();
  try {
    const [, write] = await env.DB.batch([
      env.DB.prepare("DELETE FROM tutor_requests WHERE at < ?").bind(
        now - 86400000,
      ),
      env.DB.prepare(
        "INSERT INTO tutor_requests(owner,at) SELECT ?,? WHERE (SELECT COUNT(*) FROM tutor_requests WHERE owner=? AND at>=?)<8 AND (SELECT COUNT(*) FROM tutor_requests WHERE owner=? AND at>=?)<100 AND (SELECT COUNT(*) FROM tutor_requests WHERE at>=?)<400",
      ).bind(
        owner,
        now,
        owner,
        now - 60000,
        owner,
        now - 86400000,
        now - 86400000,
      ),
    ]);
    if (!write.meta.changes)
      return reply(
        { error: "已达到助教调用频率或当日额度，请稍后再试。" },
        429,
      );
  } catch {
    return reply({ error: "暂时无法记录调用量，请稍后重试。" }, 503);
  }
  return tutorResponse(input, env, req.signal);
}
