import course from "../../../../lib/course/course.json";
import history from "../../../../lib/course/course-history.json";
import { accountOwner, accountReply } from "../../../../lib/study-account";
import { hash } from "../../../../lib/site-login";
let pack: { body: string; etag: Promise<string> } | undefined;
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ part: string }> },
) {
  if (!(await accountOwner(req)))
    return accountReply({ error: "请先登录。" }, 401);
  const { part } = await params;
  if (part === "pack") {
    if (!pack) {
      const body = JSON.stringify({ course, history });
      pack = { body, etag: hash(body).then((digest) => '"' + digest + '"') };
    }
    const etag = await pack.etag;
    const headers = {
      "Cache-Control": "private, no-cache",
      Vary: "Cookie",
      ETag: etag,
      "Content-Type": "application/json; charset=utf-8",
    };
    if (req.headers.get("If-None-Match") === etag)
      return new Response(null, { status: 304, headers });
    return new Response(pack.body, { headers });
  }
  if (part === "bank") return accountReply(course);
  if (part === "history") return accountReply(history);
  return accountReply({ error: "资料不存在。" }, 404);
}
