import { localUser } from "../../../lib/site-login";
import { accountScope, accountReply } from "../../../lib/study-account";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const user = await localUser(req.headers);
  if (!user) return accountReply({ signedIn: false }, 401);
  return accountReply({
    local: !!user,
    signedIn: true,
    email: user?.name || "",
    scope: await accountScope(user.id),
  });
}
