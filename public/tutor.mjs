import { prepareScreenshot } from "./tutor-image.mjs";
import { chapter, esc, formOf, icon, letters } from "./ui.mjs";

import { events as savedEvents, add as saveEvent } from "./store.mjs";
import { rich, markdown } from "./deferred-notation.mjs";

const prompts = {
  hint: "请只给我下一步提示，让我自己完成这道题。",
  explain: "请分步解析本题，并告诉我怎样检验答案。",
  diagnose: "根据我提交的答案，我的第一处错误可能在哪里？怎样自查？",
  variant: "出一道同题型的变式让我做，先保留答案。",
};
const generic = [
  "为什么 HOCl 和 H₂O 的点群不同？",
  "p² 的 15 个微观状态怎样分成三个谱项？",
  "怎么从丁二烯的 π 能量算出离域稳定化能？",
];
const threads = new Map();
let settings;
async function capabilities() {
  if (!settings)
    settings = fetch("/api/tutor", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const v = await r.json();
        if (!Array.isArray(v.models)) throw Error();
        return v;
      })
      .catch((e) => {
        settings = null;
        throw e;
      });
  return settings;
}
function fingerprint(s) {
  let n = 2166136261;
  for (const c of s) {
    n ^= c.codePointAt(0);
    n = Math.imul(n, 16777619);
  }
  return (n >>> 0).toString(36);
}
export function questionTutor(q, attempt, mode) {
  const ctx = {
    章节: chapter(q.chapter).name,
    题型: q.type,
    知识点: q.topic,
    题干: q.stem,
  };
  if (q.image) ctx.题干 += "（原题另含配图，可粘贴截图作为附件。）";
  if (q.options.length)
    ctx.选项 = q.options.map((o, i) => letters[i] + ". " + o).join("\n");
  if (mode !== "hint") {
    const f = formOf(q);
    ctx.参考结论 =
      f === "choice"
        ? q.answers.map((i) => letters[i] + ". " + q.options[i]).join("、")
        : f === "number"
          ? q.value + " " + q.unit
          : f === "blank"
            ? q.accepted.join(" 或 ")
            : "";
    ctx.已有解析 = q.explanation;
    ctx.评分点 = q.rubric.join("；");
    if (attempt) {
      const answer = attempt.choice?.join("、") || attempt.text || "";
      ctx.本次作答 =
        (answer || "仅有自评记录") +
        (attempt.sketch?.length ? "（含手绘图，当前对话未传图）" : "");
      if (attempt.reason) ctx.自己标记的错因 = attempt.reason;
    }
  }
  return {
    id:
      "题目-" +
      q.id +
      "-" +
      fingerprint(JSON.stringify(ctx)) +
      (mode === "hint" ? "-hint" : "-review"),
    mode,
    context: ctx,
    title: q.topic || "本题答疑",
    subtitle: q.stem,
    initial: prompts[mode],
  };
}
export function labTutor(observation) {
  return {
    id: "模型-" + fingerprint(observation),
    mode: "ask",
    title: "解释当前模型",
    subtitle: observation.split("\n")[0],
    context: { 模型观察: observation },
    initial:
      "结合我当前看到的模型，解释最值得观察的变化，再给一个可以动手验证的小问题。",
  };
}
export function reviewTutor(model, round, candidates = null, apply = null) {
  const byChapter = new Map();
  for (const q of model.qs) {
    const row = byChapter.get(q.chapter) || {
      章: chapter(q.chapter).name,
      题库: 0,
      已练: 0,
      作答: 0,
      答对: 0,
    };
    row.题库++;
    const attempts = (model.hist.get(q.id) || []).filter((a) => !a.historical);
    if (attempts.length) row.已练++;
    row.作答 += attempts.length;
    row.答对 += attempts.filter((a) => a.ok).length;
    byChapter.set(q.chapter, row);
  }
  const errors = {};
  for (const a of model.graded)
    if (!a.ok && a.reason && !a.historical)
      errors[a.reason] = (errors[a.reason] || 0) + 1;
  const context = {
    练习概况: JSON.stringify({
      章节: [...byChapter.values()],
      错因: errors,
      题单: round.groups.map((g) => ({
        目的: g.label,
        题目: g.ids
          .map((id) => {
            const q = model.byId.get(id);
            return (
              q && [chapter(q.chapter).short, q.topic, q.type, q.difficulty]
            );
          })
          .filter(Boolean),
      })),
    }),
  };
  if (candidates) {
    context.可选试题 = JSON.stringify(
      candidates.map((id, index) => {
        const q = model.byId.get(id),
          last = model.hist.get(id)?.at(-1);
        return [
          index + 1,
          chapter(q.chapter).short,
          q.topic.slice(0, 33),
          q.type,
          q.difficulty,
          last?.ok === true ? "对" : last?.ok === false ? "错" : "未练",
        ];
      }),
    );
  }
  return {
    id: "复习-" + fingerprint(JSON.stringify(context)),
    mode: "ask",
    context,
    title: "AI 复习建议",
    selection: candidates && { candidates, count: round.ids.length, apply },
    subtitle: "根据当前练习概况与可开始的题单分析。",
    initial:
      "根据练习概况和题单，区分练得少与错得多的章节，给出下一轮练法和一条可操作的自查要求。数据不足时先安排诊断题，不猜测掌握情况。不虚构题目或完成记录。" +
      (candidates
        ? " 可选试题每行依次为序号、章节、考点、题型、难度（1基础、2进阶）、最近作答。选择恰好 " +
          round.ids.length +
          " 个不同序号，兼顾重复错题、覆盖不足与难度；最后另起一行输出「题号：」加用逗号分隔的序号，供页面应用。"
        : ""),
  };
}
export const generalTutor = {
  id: "自由答疑",
  mode: "ask",
  context: {},
  title: "结构化学答疑",
  subtitle: "可以问一个概念、核对一段推导，或把卡住的那一步写下来。",
};
export function tutorShell(back) {
  const controls = back
    ? '<div class="tools"><button class="btn small" data-action="tutor-back">← ' +
      (back.page === "lab" ? "返回模型" : "返回练习") +
      '</button><button class="plain" data-action="tutor-general">自由提问</button></div>'
    : "";
  return (
    '<header class="pagehead"><div><h1>AI 答疑</h1><p>' +
    (back ? "助教已带上当前题目或模型。" : "输入一道题，或选一个问题开始。") +
    "</p></div>" +
    controls +
    '</header><section class="box tutor-work" id="tutor-main"></section>'
  );
}
function formatReply(el, source) {
  if (el.isConnected) el.innerHTML = markdown(source);
}
function turnNode(thread, row) {
  const box = document.createElement("article");
  box.className = "tutor-turn " + row.role;
  const who = document.createElement("div");
  who.className = "tutor-who";
  const label = document.createElement("strong");
  label.textContent = row.role === "user" ? "你" : "AI 助教";
  const meta = document.createElement("small");
  who.append(label, meta);
  const content = document.createElement("div");
  content.className = "tutor-text";
  box.append(who, content);
  thread.append(box);
  return { content, meta };
}
export function mountTutor(host, spec = generalTutor, inline = false) {
  const thread = threads.get(spec.id) || {
    messages: savedEvents()
      .filter((e) => e.kind === "dialogue" && e.data.thread === spec.id)
      .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
      .slice(-18)
      .flatMap((e) => [
        { role: "user", content: e.data.question },
        {
          role: "assistant",
          content: e.data.answer,
          meta: e.data.model,
          interrupted: !!e.data.interrupted,
        },
      ]),
    lastOpened: savedEvents()
      .filter((e) => e.kind === "dialogue" && e.data.thread === spec.id)
      .sort((a, b) => b.at - a.at)[0]?.data.mode,
    draft: "",
    model: "auto",
  };
  threads.set(spec.id, thread);
  if (threads.size > 35) threads.delete(threads.keys().next().value);
  let alive = true,
    controller = null,
    ready = false;
  const pick =
    spec.mode === "hint"
      ? ["给我一个起点", "我可以用哪个条件自查？"]
      : spec.id === "自由答疑"
        ? generic
        : spec.context.模型观察
          ? ["我应该改变哪个参数？", "换一个例子会怎样？"]
          : ["为什么这一步成立？", "能用另一种方法核对吗？", "再出一道同型题"];
  host.innerHTML =
    '<div class="tutor-heading"><span class="iconblock teal">' +
    icon("spark", 22) +
    "</span><div><h2>" +
    esc(spec.title) +
    "</h2><p>" +
    rich(spec.subtitle) +
    '</p></div></div><div class="tutor-thread" aria-label="当前对话"></div><div class="tutor-presets"></div><form class="tutor-compose"><textarea aria-label="向 AI 提问" maxlength="1500" rows="2"></textarea><div class="tutor-attachment" hidden><img alt="待发送的题目截图"><button type="button" class="plain remove-img">移除图片</button></div><input type="file" class="tutor-file" accept="image/png,image/jpeg,image/webp" hidden><div class="tutor-controls"><button type="button" class="btn small attach-img">添加图片</button><label>模型 <select aria-label="助教模型"><option value="auto">自动选择</option></select></label><div><button type="button" class="btn small tutor-stop" hidden>停止</button> <button type="submit" class="btn primary">' +
    icon("spark", 15) +
    '发送</button></div></div></form><div class="tutor-status" role="status"></div><p class="tutor-data">发送时，问题、附图和对话文字会提交给所选模型。AI 回答可与题库解析和交互模型交叉核对。</p>';
  const find = (s) => host.querySelector(s),
    log = find(".tutor-thread"),
    input = find("textarea"),
    select = find("select"),
    form = find("form"),
    send = find('[type="submit"]'),
    stop = find(".tutor-stop"),
    status = find(".tutor-status"),
    presets = find(".tutor-presets");
  const picker = find(".tutor-file"),
    attach = find(".attach-img"),
    preview = find(".tutor-attachment");
  let draftImage = "",
    preparing = false,
    models = [];
  function showImage(image) {
    draftImage = image;
    preview.hidden = !image;
    if (image) preview.querySelector("img").src = image;
    else preview.querySelector("img").removeAttribute("src");
    for (const o of select.options)
      o.disabled = Boolean(
        image && models.find((m) => m.id === o.value && !m.vision),
      );
    if (select.selectedOptions[0]?.disabled) {
      select.value = "auto";
      thread.model = "auto";
    }
    manage();
  }
  async function addFile(file) {
    if (!file || preparing || controller) return;
    if (!ready || !models.some((m) => m.vision)) {
      notice("当前没有可用的读图模型，请稍后重试。");
      return;
    }
    preparing = true;
    manage();
    try {
      const image = await prepareScreenshot(file);
      if (alive) {
        showImage(image);
        notice("图片已就绪，可以发送。");
        input.focus();
      }
    } catch (e) {
      if (alive) notice(e.message || "图片读取失败，请重新选择。");
    } finally {
      preparing = false;
      manage();
      picker.value = "";
    }
  }
  attach.onclick = () => picker.click();
  picker.onchange = () => void addFile(picker.files[0]);
  find(".remove-img").onclick = () => {
    showImage("");
    notice("");
    input.focus();
  };
  form.onpaste = (e) => {
    const item = Array.from(e.clipboardData?.items || []).find(
      (i) => i.kind === "file" && i.type.startsWith("image/"),
    );
    if (!item) return;
    e.preventDefault();
    void addFile(item.getAsFile());
  };
  if (inline) {
    host.querySelector(".tutor-heading")?.remove();
    presets.hidden = true;
    host.querySelector(".tutor-data")?.remove();
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "plain inline-follow";
    toggle.textContent = "继续追问";
    form.before(toggle);
    form.hidden = true;
    toggle.onclick = () => {
      form.hidden = false;
      toggle.hidden = true;
      input.focus();
    };
  }
  const manage = () => {
    send.disabled = !ready || !!controller || preparing;
    attach.disabled =
      !ready || !!controller || preparing || !models.some((m) => m.vision);
    find(".remove-img").disabled = preparing;
    select.disabled = !!controller;
    stop.hidden = !controller;
    for (const b of presets.children) b.disabled = !ready || !!controller;
  };
  function scroll() {
    log.scrollTop = log.scrollHeight;
  }
  function paintAnswer(element, source, finished = false) {
    const selection = spec.selection;
    const pattern = /(?:^|\n)题号[：:]\s*([0-9,， 、]+)\s*$/;
    const result = selection && source.match(pattern);
    formatReply(element, result ? source.slice(0, result.index) : source);
    if (!finished || !result || !element.isConnected) return;
    const indices = result[1]
      .trim()
      .split(/[,，、 ]+/)
      .map(Number);
    const ids = indices.map((i) => selection.candidates[i - 1]);
    if (
      ids.length !== selection.count ||
      ids.some((id) => !id) ||
      new Set(ids).size !== ids.length
    )
      return;
    const use = document.createElement("button");
    use.type = "button";
    use.className = "btn small";
    use.textContent = "预览 AI 调整后的题单";
    use.onclick = () => selection.apply(ids);
    element.append(use);
  }
  function display(row) {
    const { content, meta } = turnNode(log, row);
    meta.textContent = row.meta || "";
    content.textContent = row.content;
    if (row.role === "assistant" && row.content)
      paintAnswer(content, row.content, !row.interrupted);
    return { content, meta };
  }
  if (spec.id === "自由答疑") host.querySelector(".tutor-heading")?.remove();
  (inline ? thread.messages.slice(-2) : thread.messages).forEach(display);
  if (spec.id === "自由答疑" && thread.messages.length === 0)
    host.classList.add("tutor-empty");
  input.value = thread.draft;
  const button = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tutor-preset";
    b.textContent = label;
    b.onclick = fn;
    presets.append(b);
  };
  pick.forEach((s) =>
    button(s, () => submit(s, s === "再出一道同型题" ? "variant" : spec.mode)),
  );
  stop.onclick = () => controller?.abort();
  input.oninput = () => {
    thread.draft = input.value;
  };
  input.onkeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    void submit(input.value, spec.mode);
  };
  select.onchange = () => {
    thread.model = select.value;
  };
  function notice(s) {
    status.replaceChildren();
    status.textContent = s;
  }
  function signIn() {
    const a = document.createElement("a");
    a.href = "/" + location.hash;
    a.target = "_top";
    a.textContent = "重新登录";
    status.replaceChildren(a, document.createTextNode("，继续本次答疑。"));
  }
  async function submit(value, mode, image = draftImage) {
    const message = value.trim() || (image ? "请解析图片中的结构化学题。" : "");
    if (preparing) return;
    if (!alive || !ready || controller || !message) return;
    host.classList.remove("tutor-empty");
    const abort = new AbortController();
    controller = abort;
    manage();
    notice("正在连接模型…");
    const history = thread.messages
      .filter((m) => !m.interrupted && m.content)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    const question = (image ? "［附题目截图］ " : "") + message;
    const user = { role: "user", content: question },
      bot = { role: "assistant", content: "", meta: "等待模型" };
    thread.messages.push(user, bot);
    if (thread.messages.length > 36) thread.messages.splice(0, 2);
    const turn = display(user);
    if (image) {
      const img = document.createElement("img");
      img.src = image;
      img.alt = "本次发送的题目截图";
      img.className = "tutor-sent-image";
      turn.content.append(img);
      showImage("");
    }
    const { content, meta } = display(bot);
    thread.draft = "";
    input.value = "";
    scroll();
    let modelName = "",
      ended = false,
      failed = false;
    const start = performance.now();
    let paintTimer = 0;
    const paint = () => {
      paintTimer = 0;
      if (!alive || !content.isConnected) return;
      const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      paintAnswer(content, bot.content);
      if (nearEnd) scroll();
    };
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          mode,
          model: select.value,
          message,
          image: image || undefined,
          context: spec.context,
          history,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          settings = null;
          ready = false;
          signIn();
        }
        const info = await res.json().catch(() => ({}));
        throw Error(info.error || "暂时无法连接助教。");
      }
      if (!res.body) throw Error("浏览器没有收到应答流。");
      const reader = res.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        first = 0;
      try {
        for (;;) {
          const part = await reader.read();
          buffer +=
            decoder.decode(part.value, { stream: !part.done }) +
            (part.done ? "\n" : "");
          let i;
          while ((i = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, i).trim();
            buffer = buffer.slice(i + 1);
            if (!line) continue;
            const event = JSON.parse(line);
            if (event.type === "model") {
              modelName = event.id;
              bot.meta = modelName;
              meta.textContent = modelName;
              notice("等待 " + modelName + " 开始回答…");
            }
            if (event.type === "delta") {
              if (!first) {
                first = performance.now();
                notice("正在回答…");
              }
              bot.content += event.text;
              if (!paintTimer) paintTimer = setTimeout(paint, 100);
            }
            if (event.type === "error") throw Error(event.message);
            if (event.type === "done") ended = true;
          }
          if (part.done) break;
        }
      } finally {
        reader.releaseLock();
      }
      if (!ended) throw Error("连接已中断，可重试本次提问。");
      bot.meta =
        modelName +
        " · " +
        ((performance.now() - start) / 1000).toFixed(1) +
        " 秒";
      meta.textContent = bot.meta;
      notice("回答完成");
    } catch (e) {
      failed = true;
      bot.interrupted = true;
      bot.meta = [modelName, abort.signal.aborted ? "已停止" : "未完成"]
        .filter(Boolean)
        .join(" · ");
      meta.textContent = bot.meta;
      const label = abort.signal.aborted
        ? "已停止生成。"
        : e.message || "请求未能完成。";
      if (!bot.content) {
        bot.content = label;
        content.textContent = label;
      }
      if (ready) {
        notice(label);
        if (alive) {
          const retry = document.createElement("button");
          retry.type = "button";
          retry.className = "plain";
          retry.textContent = "重新提问";
          retry.onclick = () => submit(message, mode, image);
          status.append(" ", retry);
        }
      }
    } finally {
      clearTimeout(paintTimer);
      controller = null;
      manage();
      if (alive && bot.content && (!failed || modelName))
        paintAnswer(content, bot.content, ended && !failed);
      if (
        modelName &&
        bot.content &&
        (!failed || ended || abort.signal.aborted)
      ) {
        try {
          await saveEvent("dialogue", {
            thread: spec.id,
            mode,
            question,
            answer: bot.content,
            model: bot.meta,
            interrupted: !!bot.interrupted,
          });
        } catch {
          if (alive) notice("回答已显示，本次对话保存失败。");
        }
      }
    }
  }
  manage();
  notice("正在检查模型连接…");
  capabilities()
    .then((info) => {
      if (!alive) return;
      models = info.models;
      for (const { id, label } of info.models) {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = label;
        select.append(o);
      }
      select.value = [...select.options].some((o) => o.value === thread.model)
        ? thread.model
        : "auto";
      if (!info.authenticated) signIn();
      else if (!info.models.length)
        notice("当前尚未连接模型。题库中可以继续查看逐题解析。");
      else {
        ready = true;
        notice("");
      }
      manage();
      scroll();
      if (
        ready &&
        spec.initial &&
        (!thread.messages.length ||
          (inline && thread.messages.at(-1)?.interrupted))
      )
        void submit(spec.initial, spec.mode);
      else if (
        ready &&
        spec.initial &&
        spec.mode !== thread.lastOpened &&
        thread.messages.length &&
        spec.mode !== "ask"
      )
        void submit(spec.initial, spec.mode);
      thread.lastOpened = spec.mode;
    })
    .catch(() => {
      if (alive) notice("暂时无法读取助教状态，请重新打开。");
    });
  return () => {
    alive = false;
    controller?.abort();
  };
}
