import { env } from "cloudflare:workers";
import { accountReply, sameSite } from "../../../lib/study-account";
import {
  deliver,
  digestCode,
  mailReady,
  validEmail,
} from "../../../lib/gmail-code";
import { hash } from "../../../lib/site-login";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (
    !sameSite(req) ||
    !req.headers.get("Content-Type")?.startsWith("application/json")
  )
    return accountReply({ error: "请求无效。" }, 403);
  const v = (await req.json().catch(() => null)) as {
    email?: string;
    purpose?: string;
  } | null;
  const email = String(v?.email || "")
      .trim()
      .toLowerCase(),
    purpose = String(v?.purpose || "");
  if (!validEmail(email) || !["register", "reset"].includes(purpose))
    return accountReply(
      { field: "name", error: "请输入完整的邮箱地址。" },
      400,
    );
  if (!env.DB)
    return accountReply(
      { field: "code", error: "发送服务暂时不可用，请稍后重试。" },
      503,
    );
  const db = env.DB,
    now = Date.now(),
    window = Math.floor(now / 600000),
    ip = await hash(
      "mail:" + String(req.headers.get("cf-connecting-ip") || "shared"),
    );
  const reserve = (bucket: string, n: number) =>
    db
      .prepare(
        "INSERT INTO chem_limits(bucket,window,n) VALUES(?,?,1) ON CONFLICT(bucket,window) DO UPDATE SET n=n+1 WHERE n<?",
      )
      .bind(bucket, window, n);
  await db
    .prepare("DELETE FROM chem_limits WHERE window<?")
    .bind(window - 1)
    .run();
  if (!(await reserve(ip, 10).run()).meta.changes)
    return accountReply(
      {
        field: "code",
        error: "发送次数过多，请稍后再试。",
        retryAfter: Math.ceil(((window + 1) * 600000 - now) / 1000),
      },
      429,
    );
  const success = { retryAfter: 60 };
  const exists = await db
    .prepare("SELECT id FROM chem_accounts WHERE name=?")
    .bind(email)
    .first();
  if (purpose === "register" && exists)
    return accountReply(
      { field: "name", error: "该邮箱已注册。", action: "login" },
      409,
    );
  if (purpose === "reset" && !exists)
    return accountReply(
      {
        field: "name",
        error: "该邮箱尚未注册，请核对地址。",
        action: "register",
      },
      404,
    );
  if (!(await mailReady()))
    return accountReply(
      { field: "code", error: "邮件服务暂时不可用，请稍后重试。" },
      503,
    );
  const n = new Uint32Array(1);
  do {
    crypto.getRandomValues(n);
  } while (n[0] >= 4294000000);
  const code = String(n[0] % 1000000).padStart(6, "0"),
    digest = await digestCode(email, purpose, code);
  await db
    .prepare("DELETE FROM email_codes WHERE sent<?")
    .bind(now - 86400000)
    .run();
  const sent = await db
    .prepare(
      "INSERT INTO email_codes(email,purpose,digest,sent,tries) VALUES(?,?,?,?,0) ON CONFLICT(email,purpose) DO UPDATE SET digest=excluded.digest,sent=excluded.sent,tries=0 WHERE sent<?",
    )
    .bind(email, purpose, digest, now, now - 60000)
    .run();
  if (!sent.meta.changes) {
    const row = await db
      .prepare("SELECT sent FROM email_codes WHERE email=? AND purpose=?")
      .bind(email, purpose)
      .first<{ sent: number }>();
    return accountReply(
      {
        field: "code",
        error: "请稍候再试，或填写最近收到的验证码。",
        retryAfter: Math.max(
          1,
          Math.ceil(((row?.sent ?? now) + 60000 - now) / 1000),
        ),
      },
      429,
    );
  }
  if (!(await reserve("mail-total", 30).run()).meta.changes) {
    await db
      .prepare(
        "DELETE FROM email_codes WHERE email=? AND purpose=? AND digest=?",
      )
      .bind(email, purpose, digest)
      .run();
    return accountReply(
      {
        field: "code",
        error: "邮件服务繁忙，请稍后再试。",
        retryAfter: Math.ceil(((window + 1) * 600000 - now) / 1000),
      },
      429,
    );
  }
  try {
    await deliver(email, purpose, code);
  } catch {
    await db
      .prepare(
        "DELETE FROM email_codes WHERE email=? AND purpose=? AND digest=?",
      )
      .bind(email, purpose, digest)
      .run();
    return accountReply(
      { field: "code", error: "验证码未能发送，请稍后再试。" },
      503,
    );
  }
  return accountReply(success);
}
