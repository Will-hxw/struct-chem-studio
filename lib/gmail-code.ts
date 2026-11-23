import {verificationMail} from "./verification-mail";
import { env } from "cloudflare:workers";
import {readGrant,sender} from "./gmail-grant";
export const mailReady=async()=>Boolean(sender && env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && await readGrant());
export const validEmail = (s: string) =>
  s.length <= 254 &&
  /^[A-Za-z0-9_+.%'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(s);
export async function digestCode(email: string, purpose: string, code: string) {
  const enc = new TextEncoder(),
    key = await crypto.subtle.importKey(
      "raw",
      enc.encode(env.GMAIL_CLIENT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        enc.encode([email, purpose, code].join("\n")),
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function deliver(email: string, purpose: string, code: string) {
  const grant = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID!,
      client_secret: env.GMAIL_CLIENT_SECRET!,
      refresh_token: await readGrant(),
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!grant.ok) throw Error("mail authorization");
  const { access_token } = (await grant.json()) as { access_token: string };
  const mime=verificationMail(email,purpose,code);
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + access_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: btoa(mime)
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, ""),
      }),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!res.ok) throw Error("mail delivery");
}
export async function consume(email: string, purpose: string, code: string) {
  if (!/^\d{6}$/.test(code)) return "请输入 6 位数字验证码。";
  const digest = await digestCode(email, purpose, code);
  const [hit, , result] = await env.DB!.batch([
    env
      .DB!.prepare(
        "DELETE FROM email_codes WHERE email=? AND purpose=? AND digest=? AND sent>? AND tries<5",
      )
      .bind(email, purpose, digest, Date.now() - 600000),
    env
      .DB!.prepare(
        "UPDATE email_codes SET tries=tries+1 WHERE email=? AND purpose=? AND tries<5",
      )
      .bind(email, purpose),
    env.DB!.prepare("SELECT sent,tries FROM email_codes WHERE email=? AND purpose=?").bind(email,purpose),
  ]);
  if (hit.meta.changes) return null;
  const row = result.results[0] as {sent:number;tries:number}|undefined;
  if (!row) return "请先获取新的验证码。";
  if (row.sent <= Date.now()-600000) return "验证码已过期，请重新获取。";
  if (row.tries >= 5) return "验证码输入错误次数已达上限，请重新获取。";
  return "验证码不正确，请核对最新邮件中的 6 位数字。";
}
