import { env } from "cloudflare:workers";
const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(b as ArrayBuffer), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
export const random = (n: number) =>
  hex(crypto.getRandomValues(new Uint8Array(n)));
export const hash = async (v: string) =>
  hex(await crypto.subtle.digest("SHA-256", enc.encode(v)));
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: 100000,
        salt: enc.encode(salt),
      },
      key,
      256,
    ),
  );
}
export function token(h: { get(k: string): string | null }) {
  return (h.get("cookie") || "").match(
    /(?:^|;\s*)__Host-sclab=([0-9a-f]{64})(?:;|$)/,
  )?.[1];
}
export async function localUser(h: { get(k: string): string | null }) {
  const t = token(h);
  if (!t || !env.DB) return null;
  return env.DB.prepare(
    "SELECT a.id,a.name FROM chem_sessions s JOIN chem_accounts a ON s.uid=a.id WHERE a.id LIKE 'email-%' AND s.digest=? AND s.expiry>?",
  )
    .bind(await hash(t), Date.now())
    .first<{ id: string; name: string }>();
}
export const sessionCookie = (t: string) =>
  "__Host-sclab=" +
  t +
  "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" +
  (t ? 2592000 : 0);
