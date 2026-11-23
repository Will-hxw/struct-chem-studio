import { consume, validEmail, mailReady } from "../../../lib/gmail-code";
import { env } from "cloudflare:workers";
import {
  hash,
  random,
  passwordHash,
  token,
  sessionCookie,
} from "../../../lib/site-login";
import { sameSite, accountHeaders } from "../../../lib/study-account";
export const dynamic = "force-dynamic";
const send = (data: unknown, status = 200, cookie?: string) =>
  Response.json(data, {
    status,
    headers: { ...accountHeaders, ...(cookie ? { "Set-Cookie": cookie } : {}) },
  });
export async function POST(req: Request) {
  if (
    !sameSite(req) ||
    !req.headers.get("content-type")?.startsWith("application/json")
  )
    return send({ error: "请求无效。" }, 403);
  const db = env.DB;
  if (!db) return send({ error: "暂时无法连接数据库。" }, 503);
  const v = (await req.json().catch(() => null)) as {
    name?: string;
    password?: string;
    action: string;
    current?: string;
    code?: string;
  } | null;
  if (!v) return send({ error: "请求无效。" }, 400);
  if (v.action === "logout") {
    const t = token(req.headers);
    if (t)
      await db
        .prepare("DELETE FROM chem_sessions WHERE digest=?")
        .bind(await hash(t))
        .run();
    return send({ ok: true }, 200, sessionCookie(""));
  }
  const name = String(v.name || "")
      .trim()
      .normalize("NFKC")
      .toLowerCase(),
    pw = v.password;
  if (!validEmail(name))
    return send({ field: "name", error: "请输入完整的邮箱地址。" }, 400);
  if (!["register", "login", "reset", "change"].includes(v.action))
    return send({ error: "请求无效。" }, 400);
  if (
    typeof pw !== "string" ||
    !pw.length ||
    pw.length > 128 ||
    (v.action !== "login" && pw.length < 8)
  )
    return send(
      {
        field: "password",
        error:
          v.action === "login"
            ? "请输入密码。"
            : "密码长度须为 8 至 128 个字符。",
      },
      400,
    );
  const now = Date.now(),
    ip = await hash(
      "client:" + String(req.headers.get("cf-connecting-ip") || "shared"),
    ),
    win = Math.floor(now / 600000);
  const [, limit] = await db.batch([
    db.prepare("DELETE FROM chem_limits WHERE window<?").bind(win - 1),
    db
      .prepare(
        "INSERT INTO chem_limits(bucket,window,n) VALUES(?,?,1) ON CONFLICT(bucket,window) DO UPDATE SET n=n+1 WHERE n<60",
      )
      .bind(ip, win),
  ]);
  if (!limit.meta.changes)
    return send({ error: "操作较频繁，请稍后重试。" }, 429);
  if (["register", "reset"].includes(v.action)) {
    if (!(await mailReady()))
      return send(
        { field: "code", error: "验证服务暂时不可用，请稍后重试。" },
        503,
      );
    const exists = await db
      .prepare("SELECT id FROM chem_accounts WHERE name=?")
      .bind(name)
      .first();
    if (v.action === "register" && exists)
      return send(
        { field: "name", error: "该邮箱已注册。", action: "login" },
        409,
      );
    if (v.action === "reset" && !exists)
      return send(
        {
          field: "name",
          error: "该邮箱尚未注册，请核对地址。",
          action: "register",
        },
        404,
      );
    const error = await consume(name, v.action, String(v.code || ""));
    if (error) return send({ field: "code", error }, 400);
  }
  let uid = "",
    recovery = "",
    stamp = "";
  if (v.action === "register") {
    uid = "email-" + crypto.randomUUID();
    const salt = random(16);
    stamp = salt;
    recovery = "";
    const out = await db
      .prepare(
        "INSERT INTO chem_accounts(id,name,salt,pw,recovery) VALUES(?,?,?,?,?) ON CONFLICT(name) DO NOTHING",
      )
      .bind(uid, name, salt, await passwordHash(pw, salt), "")
      .run();
    if (!out.meta.changes)
      return send(
        { field: "name", error: "该邮箱已注册。", action: "login" },
        409,
      );
  } else {
    const a = await db
      .prepare("SELECT id,salt,pw,recovery FROM chem_accounts WHERE name=?")
      .bind(name)
      .first<{ id: string; salt: string; pw: string; recovery: string }>();
    const valid =
      v.action === "reset"
        ? true
        : (await passwordHash(
            v.action === "change" ? String(v.current || "").slice(0, 128) : pw,
            a?.salt || "empty-account",
          )) === a?.pw;
    if (!a || !valid)
      return send(
        {
          field:
            v.action === "change"
              ? "current"
              : v.action === "reset"
                ? "name"
                : "password",
          error:
            v.action === "change"
              ? "当前密码不正确。"
              : v.action === "reset"
                ? "该邮箱尚未注册。"
                : "邮箱或密码不正确，请重新输入。",
        },
        401,
      );
    uid = a.id;
    stamp = a.salt;
    if (v.action !== "login") {
      const salt = random(16);
      stamp = salt;
      recovery = "";
      const [changed] = await db.batch([
        db
          .prepare(
            "UPDATE chem_accounts SET salt=?,pw=?,recovery=? WHERE id=? AND pw=? AND recovery=?",
          )
          .bind(salt, await passwordHash(pw, salt), "", uid, a.pw, a.recovery),
        db
          .prepare(
            "DELETE FROM chem_sessions WHERE uid=? AND EXISTS(SELECT 1 FROM chem_accounts WHERE id=? AND salt=?)",
          )
          .bind(uid, uid, salt),
      ]);
      if (!changed.meta.changes)
        return send({ error: "账号已更新，请重试。" }, 409);
    }
  }
  const key = random(32);
  const [, issued] = await db.batch([
    db.prepare("DELETE FROM chem_sessions WHERE expiry<?").bind(now),
    db
      .prepare(
        "INSERT INTO chem_sessions(digest,uid,expiry) SELECT ?,id,? FROM chem_accounts WHERE id=? AND salt=?",
      )
      .bind(await hash(key), now + 2592000000, uid, stamp),
  ]);
  if (!issued.meta.changes)
    return send({ error: "账号已更新，请重新登录。" }, 409);
  return send({ ok: true }, 200, sessionCookie(key));
}
