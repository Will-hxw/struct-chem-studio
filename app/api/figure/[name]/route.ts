import figures from "../../../../lib/course/figures.json";
import {
  accountHeaders,
  accountOwner,
  accountReply,
} from "../../../../lib/study-account";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!(await accountOwner(req)))
    return accountReply({ error: "请先登录。" }, 401);
  const { name } = await params;
  if (!Object.hasOwn(figures, name))
    return accountReply({ error: "题图不存在。" }, 404);
  return new Response(
    Uint8Array.from(atob(figures[name as keyof typeof figures]), (s) => s.charCodeAt(0)),
    { headers: { ...accountHeaders, "Content-Type": "image/png" } },
  );
}
