"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Mode = "login" | "register" | "reset" | "change";
type Field = "name" | "code" | "current" | "password" | "form";
type Notice = {
  error?: string;
  field?: Field;
  action?: Mode;
  retryAfter?: number;
};
const titles = {
  login: "登录",
  register: "注册",
  reset: "重设密码",
  change: "修改密码",
};

export default function LoginForm({
  initial,
  name = "",
}: {
  initial: Mode;
  name?: string;
}) {
  const [mode, setMode] = useState(initial);
  const [email, setEmail] = useState(name);
  const [errors, setErrors] = useState<Partial<Record<Field, Notice>>>({});
  const [pending, setPending] = useState<"send" | "submit" | null>(null);
  const [sent, setSent] = useState(false);
  const [ends, setEnds] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now);
  const form = useRef<HTMLFormElement>(null);
  const lock = useRef(false);
  const key = mode + ":" + email.trim().toLowerCase();
  const seconds = Math.max(0, Math.ceil(((ends[key] || 0) - now) / 1000));
  const hasCode = mode === "register" || mode === "reset";
  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [seconds, now]);
  function go(next: Mode) {
    setMode(next);
    setErrors({});
    setSent(false);
    history.replaceState(
      null,
      "",
      location.pathname +
        (next === "login" ? "" : "?auth=" + next) +
        location.hash,
    );
  }
  function clear(field: Field) {
    setErrors((old) => ({ ...old, [field]: undefined, form: undefined }));
  }
  function problem(field: Field, notice: Notice) {
    setErrors((old) => ({ ...old, [field]: notice }));
    if (field !== "form")
      (form.current?.elements.namedItem(field) as HTMLInputElement)?.focus();
  }
  function message(field: Field) {
    const notice = errors[field];
    if (!notice) return null;
    return (
      <div id={"msg-" + field} className="auth-msg" role="alert">
        {notice.error}
        {notice.action && (
          <button type="button" onClick={() => go(notice.action!)}>
            {notice.action === "login" ? "去登录" : "去注册"}
          </button>
        )}
      </div>
    );
  }
  function props(field: Field) {
    return {
      id: "auth-" + field,
      name: field,
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": errors[field] ? "msg-" + field : undefined,
      readOnly: !!pending,
      onChange: () => clear(field),
    };
  }
  async function request(sendOnly: boolean) {
    if (lock.current || !form.current) return;
    const data = Object.fromEntries(new FormData(form.current));
    const invalid: Partial<Record<Field, Notice>> = {};
    const address = email.trim().toLowerCase();
    if (!address) invalid.name = { error: "请输入邮箱地址。" };
    else if (
      address.length > 254 ||
      !/^[A-Za-z0-9_+.%'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(address)
    )
      invalid.name = { error: "请输入完整的邮箱地址，例如 name@qq.com。" };
    if (!sendOnly) {
      if (hasCode && !/^\d{6}$/.test(String(data.code || "")))
        invalid.code = { error: "请输入邮件中的 6 位数字验证码。" };
      if (mode === "change" && !data.current)
        invalid.current = { error: "请输入当前密码。" };
      if (!data.password)
        invalid.password = {
          error:
            mode === "reset" || mode === "change"
              ? "请输入新密码。"
              : "请输入密码。",
        };
      else if (mode !== "login" && String(data.password).length < 8)
        invalid.password = { error: "密码至少需要 8 个字符。" };
    }
    setErrors(invalid);
    const first = Object.keys(invalid)[0] as Field | undefined;
    if (first) {
      (form.current.elements.namedItem(first) as HTMLInputElement)?.focus();
      return;
    }
    lock.current = true;
    setPending(sendOnly ? "send" : "submit");
    if (sendOnly) setSent(false);
    const fallback = sendOnly ? "code" : "form";
    try {
      const res = await fetch(sendOnly ? "/api/email-code" : "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sendOnly
            ? { email: address, purpose: mode }
            : { ...data, name: address, action: mode },
        ),
        signal: AbortSignal.timeout(35000),
      });
      const reply = (await res
        .json()
        .catch(() => ({ error: "服务暂时不可用，请稍后重试。" }))) as Notice;
      if (sendOnly && reply.retryAfter) {
        const at = Date.now();
        setNow(at);
        setEnds((last) => ({
          ...last,
          [key]: at + 1000 * Number(reply.retryAfter),
        }));
      }
      if (!res.ok || reply.error) {
        problem(reply.field || fallback, {
          ...reply,
          error: reply.error || "服务暂时不可用，请稍后重试。",
        });
        return;
      }
      if (sendOnly) {
        setSent(true);
        (form.current.elements.namedItem("code") as HTMLInputElement)?.focus();
      } else location.replace("/" + location.hash);
    } catch {
      problem(fallback, { error: "连接失败，请检查网络后重试。" });
    } finally {
      lock.current = false;
      setPending(null);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void request(false);
  }
  return (
    <main className="auth-cover">
      <section className="auth-block">
        <h1>结构化学</h1>
        <h2>{titles[mode]}</h2>
        <form key={mode} ref={form} noValidate onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="auth-name">邮箱</label>
            <input
              {...props("name")}
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              value={email}
              placeholder="输入邮箱"
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({});
                setSent(false);
                const code = form.current?.elements.namedItem(
                  "code",
                ) as HTMLInputElement | null;
                if (code) code.value = "";
              }}
            />
            {message("name")}
          </div>
          {hasCode && (
            <div className="auth-field">
              <label htmlFor="auth-code">邮箱验证码</label>
              <div className="otp-row">
                <input
                  {...props("code")}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                />
                <button
                  className="btn send-code"
                  type="button"
                  disabled={!!pending || seconds > 0}
                  onClick={() => void request(true)}
                >
                  {pending === "send"
                    ? "发送中…"
                    : seconds
                      ? seconds + " 秒后重发"
                      : "发送验证码"}
                </button>
              </div>
              {message("code")}
              {sent && !errors.code && (
                <div className="auth-success" role="status">
                  验证码已发送，10 分钟内有效。
                </div>
              )}
            </div>
          )}
          {mode === "change" && (
            <div className="auth-field">
              <label htmlFor="auth-current">当前密码</label>
              <input
                {...props("current")}
                required
                type="password"
                autoComplete="current-password"
              />
              {message("current")}
            </div>
          )}
          <div className="auth-field">
            <label htmlFor="auth-password">
              {mode === "change" || mode === "reset" ? "新密码" : "密码"}
            </label>
            <input
              {...props("password")}
              type="password"
              required
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder={mode === "login" ? "输入密码" : "至少 8 个字符"}
            />
            {message("password")}
          </div>
          {message("form")}
          <button className="btn primary" disabled={!!pending}>
            {pending === "submit" ? "请稍候…" : titles[mode]}
          </button>
        </form>
        <nav>
          {mode === "login" ? (
            <>
              <span>
                没有账号？
                <button disabled={!!pending} onClick={() => go("register")}>
                  注册
                </button>
              </span>
              <button disabled={!!pending} onClick={() => go("reset")}>
                忘记密码
              </button>
            </>
          ) : (
            <button
              disabled={!!pending}
              onClick={() =>
                mode === "change"
                  ? location.replace("/" + location.hash)
                  : go("login")
              }
            >
              {mode === "change" ? "返回学习空间" : "返回登录"}
            </button>
          )}
        </nav>
      </section>
      <footer>Hua Xiaowei —— ZJU</footer>
    </main>
  );
}
