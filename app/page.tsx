import { headers } from "next/headers";
import { localUser } from "../lib/site-login";
import { accountScope } from "../lib/study-account";
import assets from "../lib/generated/workbench.json";
import StudyClient from "./StudyClient";
import LoginForm from "./LoginForm";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const h = await headers(),
    user = await localUser(h),
    auth = (await searchParams).auth;
  if (user && auth === "change")
    return <LoginForm initial="change" name={user.name} />;
  if (user)
    return (
      <>
        <link rel="modulepreload" href={assets.script} />
        <link
          rel="preload"
          as="fetch"
          href="/api/course/pack"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="fetch"
          href="/api/start"
          crossOrigin="anonymous"
        />
        <StudyClient
          scope={await accountScope(user.id)}
          scriptUrl={assets.script}
        />
      </>
    );
  return (
    <LoginForm
      initial={
        auth === "register" ? "register" : auth === "reset" ? "reset" : "login"
      }
    />
  );
}
