import logo from "./mail-logo.json";
import { sender } from "./gmail-grant";
const b64 = (s: string) =>
  btoa(
    Array.from(new TextEncoder().encode(s), (c) => String.fromCharCode(c)).join(
      "",
    ),
  );
const fold = (s: string) => s.match(/.{1,76}/g)?.join("\r\n") || "";
export function verificationMail(to: string, purpose: string, code: string) {
  if (!/^\d{6}$/.test(code) || /[\r\n]/.test(to))
    throw Error("Invalid mail fields");
  const reset = purpose === "reset",
    action = reset ? "重设密码" : "验证邮箱";
  const intro = reset
    ? "请在重设密码页面输入以下验证码。"
    : "请在注册页面输入以下验证码，完成邮箱验证。";
  const title = "结构化学 · " + (reset ? "密码重设" : "注册") + "验证码";
  const plain = [
    "结构化学 · SC Lab",
    action,
    intro,
    code,
    "10 分钟内有效，仅限本次使用。",
    "如果这不是你的操作，可以忽略这封邮件。",
    "Hua Xiaowei —— ZJU",
  ].join("\n\n");
  const html = `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f1f5f1;color:#1b382a;font-family:'Times New Roman','Microsoft YaHei','PingFang SC',sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:white;border:1px solid #d9e2da;border-radius:12px"><tr><td style="padding:24px 28px;border-bottom:1px solid #dde6df"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="cid:sc-mark@sclab" width="42" height="42" alt="" style="display:block"></td><td style="padding-left:12px;color:#1b4632"><strong style="font-size:20px">结构化学</strong><br><span style="font-size:13px;color:#506858">SC Lab</span></td></tr></table></td></tr><tr><td style="padding:28px"><h1 style="font-size:24px;font-weight:600;margin:0 0 12px">${action}</h1><p style="margin:0 0 22px;font-size:15px;line-height:1.7">${intro}</p><div style="background:#edf4ed;border-left:3px solid #387354;padding:16px;text-align:center;color:#184831;font:normal 38px/1.25 'Times New Roman',Times,serif;letter-spacing:5px">${code}</div><p style="margin:14px 0 0;font-size:14px;color:#53665a">10 分钟内有效，仅限本次使用。</p></td></tr><tr><td style="border-top:1px solid #dde6df;padding:17px 28px;font-size:13px;color:#5d6e61;line-height:1.7">如果这不是你的操作，可以忽略这封邮件。<br>Hua Xiaowei —— ZJU</td></tr></table></td></tr></table></body></html>`;
  const alt = "sc_alt_" + crypto.randomUUID(),
    rel = "sc_rel_" + crypto.randomUUID();
  return [
    "From: SC Lab <" + sender + ">",
    "To: " + to,
    "Subject: =?UTF-8?B?" + b64(title) + "?=",
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="' + alt + '"',
    "",
    "--" + alt,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    fold(b64(plain)),
    "--" + alt,
    'Content-Type: multipart/related; boundary="' + rel + '"',
    "",
    "--" + rel,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    fold(b64(html)),
    "--" + rel,
    "Content-Type: image/png",
    "Content-ID: <sc-mark@sclab>",
    "Content-Disposition: inline; filename=sc-lab.png",
    "Content-Transfer-Encoding: base64",
    "",
    fold(logo),
    "--" + rel + "--",
    "--" + alt + "--",
    "",
  ].join("\r\n");
}
