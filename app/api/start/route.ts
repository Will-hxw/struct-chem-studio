import { env } from "cloudflare:workers";
import { localUser } from "../../../lib/site-login";
import { accountReply, accountScope } from "../../../lib/study-account";
import {
  studyPage,
  studyPageQuery,
  type StudyRow,
} from "../../../lib/study-page";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const user = await localUser(req.headers);
  if (!user || !env.DB) return accountReply({ error: "请先登录。" }, 401);
  const [events, drafts] = await env.DB.batch([
    studyPageQuery(env.DB, user.id, 0),
    env.DB.prepare(
      "SELECT kind,version,body FROM study_drafts WHERE owner=?",
    ).bind(user.id),
  ]);
  return accountReply({
    account: {
      signedIn: true,
      local: true,
      email: user.name,
      scope: await accountScope(user.id),
    },
    page: studyPage(events.results as StudyRow[], 0),
    drafts: (
      drafts.results as { kind: string; version: number; body: string }[]
    ).map((r) => ({
      kind: r.kind,
      version: r.version,
      data: JSON.parse(String(r.body)),
    })),
  });
}
