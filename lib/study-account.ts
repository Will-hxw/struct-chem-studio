import { localUser } from "./site-login";
export const accountHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};
export function accountReply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: accountHeaders });
}
export const accountOwner = async (req: Request) =>
  (await localUser(req.headers))?.id;
export function sameSite(req: Request) {
  const origin = req.headers.get("Origin");
  return (
    (!origin || origin === new URL(req.url).origin) &&
    req.headers.get("Sec-Fetch-Site") !== "cross-site"
  );
}
export async function accountScope(owner: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("study-account\0" + owner),
  );
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function authorizeWrite(req: Request, owner: string) {
  if (!sameSite(req)) return accountReply({ error: "请从本站操作。" }, 403);
  if (req.headers.get("X-Study-Scope") !== (await accountScope(owner)))
    return accountReply({ error: "账号状态已变化，请刷新页面。" }, 409);
  return null;
}

export async function checkReadScope(req: Request, owner: string) {
  const scope = req.headers.get("X-Study-Scope");
  if (scope && scope !== (await accountScope(owner)))
    return accountReply({ error: "账号已切换，请刷新。" }, 409);
  return null;
}
