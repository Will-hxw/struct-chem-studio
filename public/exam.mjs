import { rich, markdown, questionStem } from "./deferred-notation.mjs";
import { esc, icon, tag, chapter, letters, formOf, questionImages } from "./ui.mjs";
import { plan, correct, numberValue, canonical } from "./engine.mjs";
import { modal, close } from "./editor.mjs";
import { makeOrders, ordered } from "./choice-order.mjs";
const blueprint = [
  ["单选题", 15, 2],
  ["填空题", 10, 2],
  ["简答题", 6, 5],
  ["计算题", 2, 10],
];
import { saveDraft, draft } from "./store.mjs";
let exam = null,
  ctx,
  locked = false;
const save = () => saveDraft("exam", exam);
const b = (label, a, cls = "", extra = "") =>
  '<button class="btn ' +
  cls +
  '" data-action="exam-' +
  a +
  '" ' +
  extra +
  ">" +
  esc(label) +
  "</button>";
const fmtTime = (n) =>
  [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60]
    .map((x) => String(x).padStart(2, "0"))
    .join(":");
const left = () => Math.max(0, Math.ceil((exam.deadline - Date.now()) / 1000));
function examQuestion(item) {
  const current = ctx.model().byId.get(item.id);
  const snapshot = item.snapshot
    ? { ...item.snapshot, image: current?.image || "" }
    : current;
  return ordered(snapshot, item.order);
}
function snapshot(q) {
  const { image, ...copy } = q;
  return copy;
}
function autoCheck(q, d) {
  return formOf(q) === "choice"
    ? correct(q, { choice: d?.choice || [] })
    : correct(q, { text: d?.text || "" });
}
function ref(q) {
  if (formOf(q) === "choice")
    return q.answers.map((i) => letters[i] + " " + q.options[i]).join("、");
  if (formOf(q) === "number") return q.value + " " + q.unit;
  if (formOf(q) === "blank") return q.accepted.join(" / ");
  return q.explanation;
}
function summary() {
  if (!exam) return;
  const scores = exam.items.map((s, i) => {
    const q = examQuestion(s),
      d = exam.drafts[i],
      manual = formOf(q) === "written" || q.type === "计算题";
    if (pending(i)) return 0;
    return manual ? (exam.scores[i] ?? 0) : autoCheck(q, d) ? s.points : 0;
  });
  return { scores, total: scores.reduce((s, n) => s + n, 0) };
}
function stopClock() {
  if (exam?.phase === "active" && exam.startedAt) {
    const delta = Math.max(
      0,
      Math.min(Date.now(), exam.deadline) - exam.startedAt,
    );
    exam.times[exam.index] = (exam.times[exam.index] || 0) + delta;
    exam.startedAt = null;
    save();
  }
}
export function examVisibility(active) {
  if (!exam || exam.phase !== "active") return;
  if (active && !document.hidden) {
    if (!exam.startedAt) {
      exam.startedAt = Date.now();
      save();
    }
  } else stopClock();
}
export function setupExam(context) {
  ctx = context;
  exam = draft("exam");
  if (exam && !exam.bankVersion) {
    const custom = new Set(
      ctx
        .events()
        .filter((e) => e.kind === "question")
        .map((e) => e.data.id),
    );
    for (const s of exam.items) {
      const q = ctx.model().byId.get(s.id);
      if (!q) continue;
      const original = (!custom.has(s.id) && ctx.legacy?.[s.id]) || q;
      s.snapshot = snapshot({ ...q, ...original });
      s.legacyItem = true;
    }
    exam.bankVersion = 3;
    save();
  }
  setInterval(() => {
    if (exam?.phase !== "active") return;
    if (!left()) {
      stopClock();
      exam.phase = "review";
      save();
      if (ctx.page() === "exam") ctx.render();
      return;
    }
    const span = document.getElementById("exam-time");
    if (span) span.textContent = fmtTime(left());
  }, 700);
  if (exam?.phase === "active") {
    exam.startedAt = null;
    save();
  }
}
function intro() {
  const saved = ctx
    .events()
    .filter((e) => e.kind === "exam")
    .sort((a, b) => b.at - a.at);
  return (
    '<header class="pagehead"><div><h1>模拟考试</h1><p>按期末卷的题型和分值，从总题库组卷。</p></div></header><section class="box"><div class="sectionhead"><h2>期末限时模拟</h2>' +
    tag("120 分钟 · 100 分", "good") +
    '</div><p class="muted">从当前题库抽取 33 道题。交卷后统一查看解析，简答与计算题对照参考步骤自评。</p><div class="examweights">' +
    blueprint
      .map(
        ([t, n, v]) =>
          "<div><strong>" +
          n * v +
          " <small>分</small></strong><span>" +
          t +
          " · " +
          n +
          " 题 × " +
          v +
          " 分</span></div>",
      )
      .join("") +
    "</div>" +
    b("开始限时模拟", "start", "primary") +
    "</section>" +
    (saved.length
      ? '<section class="box reportcard"><h2>已完成的模拟</h2>' +
        saved
          .slice(0, 10)
          .map(
            (e) =>
              '<div class="weakrow"><span>' +
              esc(new Date(e.at).toLocaleDateString("zh-CN")) +
              "</span><b>" +
              Number(e.data.total) +
              " / 100 分</b></div>",
          )
          .join("") +
        "</section>"
      : "")
  );
}
function begin() {
  const m = ctx.model(),
    items = [];
  for (const [type, count, points] of blueprint) {
    const pool = m.qs.filter((q) => q.type === type && q.difficulty <= 2);
    if (pool.length < count) {
      ctx.toast(type + "题量不足 " + count + " 道");
      return;
    }
    for (const id of plan(pool, m, count))
      items.push({ id, points, token: crypto.randomUUID() });
  }
  const order = makeOrders(items.map((s) => m.byId.get(s.id)));
  for (const s of items) {
    s.order = order[s.id];
    s.snapshot = snapshot(m.byId.get(s.id));
  }
  exam = {
    bankVersion: ctx.revision,
    id: crypto.randomUUID(),
    items,
    phase: "active",
    index: 0,
    drafts: {},
    scores: {},
    times: {},
    startedAt: Date.now(),
    deadline: Date.now() + 120 * 60000,
  };
  save();
  ctx.render();
}
function pending(i) {
  const d = exam.drafts[i];
  return !d || !(d.choice?.length || d.text?.trim() || d.work?.trim());
}
export function examPage() {
  if (!exam) return intro();
  if (exam.items.some((x) => !examQuestion(x)))
    return '<p class="panelnote">正在等待题目同步。</p>';
  if (exam.phase === "active" && !left()) {
    stopClock();
    exam.phase = "review";
    save();
  }
  if (exam.phase === "active") {
    examVisibility(true);
    const i = exam.index,
      s = exam.items[i],
      q = examQuestion(s),
      d = exam.drafts[i] || {},
      mode = formOf(q);
    const body =
      mode === "choice"
        ? q.options
            .map(
              (o, j) =>
                '<button class="option ' +
                (d.choice?.includes(o) ? "selected" : "") +
                '" data-action="exam-pick" data-index="' +
                j +
                '"><span class="letter">' +
                letters[j] +
                "</span>" +
                rich(o) +
                "</button>",
            )
            .join("")
        : '<label class="formlabel">' +
          (mode === "number"
            ? "计算结果" + (q.unit ? "（" + rich(q.unit) + "）" : "")
            : mode === "blank"
              ? "填入答案"
              : "书面作答") +
          '<textarea id="exam-text" rows="' +
          (mode === "written" ? 5 : 2) +
          '" placeholder="输入你的答案">' +
          esc(d.text || "") +
          "</textarea></label>" +
          (mode === "number"
            ? '<label class="formlabel">计算过程<textarea id="exam-work" rows="4" placeholder="写出公式、数值代入和单位">' +
              esc(d.work || "") +
              "</textarea></label>"
            : "");
    return (
      '<header class="pagehead"><div><h1>期末限时模拟</h1><p>第 ' +
      (i + 1) +
      " / " +
      exam.items.length +
      ' 题 · 共 100 分</p></div><span class="recommend">' +
      icon("clock", 15) +
      '<span id="exam-time">' +
      fmtTime(left()) +
      '</span></span></header><div class="quizlayout"><section class="box quizcard"><div class="chips">' +
      tag(q.type, "lav") +
      tag(s.points + " 分") +
      "</div>" +
      questionStem(q.stem) +
      questionImages(q) +
      body +
      '<div class="quizbottom">' +
      b("上一题", "back", "", i === 0 ? "disabled" : "") +
      (i + 1 < exam.items.length
        ? b("下一题", "next", "primary")
        : b("交卷", "finish", "primary")) +
      '</div></section><aside class="box quizaside"><h2>答题卡</h2><div class="questionmap">' +
      exam.items
        .map(
          (_, j) =>
            '<button data-action="exam-jump" data-index="' +
            j +
            '" class="' +
            (i === j ? "current " : "") +
            (!pending(j) ? "right" : "") +
            '">' +
            (j + 1) +
            "</button>",
        )
        .join("") +
      "</div>" +
      b("提前交卷", "finish") +
      "</aside></div>"
    );
  }
  if (exam.phase === "done") {
    return (
      '<header class="pagehead"><div><h1>模拟考试结果</h1><p>选择与填空自动计分，简答与计算采用提交的自评分。</p></div></header><div class="box"><div class="resultscore">' +
      exam.total +
      ' / 100</div><div class="tools">' +
      b("再组一套", "another", "primary") +
      '<button class="btn" data-action="nav" data-page="report">查看学情分析</button></div></div>' +
      exam.items
        .map((s, i) => {
          const q = examQuestion(s),
            d = exam.drafts[i];
          return (
            '<details class="box examdetail"><summary>' +
            tag((exam.finalScores[i] || 0) + " / " + s.points + " 分") +
            " " +
            (i + 1) +
            ". " +
            rich(q.stem) +
            "</summary><p>我的答案：" +
            rich(d?.choice?.join("、") || d?.text || "未作答") +
            "</p><p>参考答案：" +
            (formOf(q) === "written" ? "" : rich(ref(q))) +
            '</p><div class="explain">' +
            markdown(q.explanation, true) +
            "</div>" + questionImages(q, "solution") + "</details>"
          );
        })
        .join("")
    );
  }
  const subs = exam.items
    .map((x, i) => ({ x, i, q: examQuestion(x) }))
    .filter(({ q }) => formOf(q) === "written" || q.type === "计算题");
  return (
    '<header class="pagehead"><div><h1>主观题与计算题自评</h1><p>试卷已封存。对照参考答案和评分点逐题给分，再查看总成绩。</p></div></header>' +
    subs
      .map(
        ({ x, i, q }) =>
          '<div class="box reviewrubric"><h3>第 ' +
          (i + 1) +
          " 题 · " +
          rich(q.stem) +
          "</h3><p>我的作答：" +
          rich(exam.drafts[i]?.text || "未作答") +
          "</p><p>参考答案：" +
          '</p><div class="explain">' +
          markdown(q.explanation, true) +
          "</div>" + questionImages(q, "solution") +
          (formOf(q) === "number"
            ? "<p>我的计算过程：" +
              rich(exam.drafts[i]?.work || "未填写") +
              "</p><p>数值核对：" +
              (autoCheck(q, exam.drafts[i]) ? "数值正确" : "未达到标准数值") +
              "，标准结果 " +
              rich(ref(q)) +
              "</p>"
            : "") +
          (q.rubric?.length
            ? "<ol>" +
              q.rubric.map((r) => "<li>" + rich(r) + "</li>").join("") +
              "</ol>"
            : "") +
          '<label class="formlabel">自评分 <select class="exam-grade" ' +
          (pending(i) ? "disabled" : "") +
          ' data-index="' +
          i +
          '"><option value="">' +
          (pending(i) ? "未作答 · 0 分" : "请选择") +
          "</option>" +
          Array.from(
            { length: x.points + 1 },
            (_, k) =>
              '<option value="' +
              k +
              '" ' +
              (exam.scores[i] === k ? "selected" : "") +
              ">" +
              k +
              " 分</option>",
          ).join("") +
          "</select></label></div>",
      )
      .join("") +
    b("保存成绩并查看结果", "score", "primary")
  );
}
export function examInput(el) {
  if (!exam) return;
  if (
    (el.id === "exam-text" || el.id === "exam-work") &&
    exam.phase === "active" &&
    left() > 0
  ) {
    exam.drafts[exam.index] = {
      ...exam.drafts[exam.index],
      [el.id === "exam-work" ? "work" : "text"]: el.value,
    };
    save();
  }
  if (el.classList.contains("exam-grade") && exam.phase === "review") {
    if (el.value === "") delete exam.scores[+el.dataset.index];
    else exam.scores[+el.dataset.index] = Number(el.value);
    save();
  }
}
export async function examAction(action, el) {
  if (action === "start") {
    begin();
    return;
  }
  if (action === "another") {
    exam = null;
    save();
    ctx.render();
    return;
  }
  if (!exam) return;
  if (exam.phase === "active" && !left()) {
    stopClock();
    exam.phase = "review";
    save();
    ctx.render();
    return;
  }
  const i = exam.index;
  if (action === "pick") {
    const q = examQuestion(exam.items[i]);
    exam.drafts[i] = { choice: [q.options[+el.dataset.index]] };
    save();
    ctx.render();
    return;
  }
  if (["jump", "back", "next"].includes(action)) {
    stopClock();
    exam.index =
      action === "jump" ? +el.dataset.index : i + (action === "back" ? -1 : 1);
    save();
    ctx.render();
    return;
  }
  if (action === "finish") {
    const n = exam.items.filter((_, j) => pending(j)).length;
    const dlg = modal(
      "确认交卷",
      '<p class="muted">' +
        (n ? "还有 " + n + " 道题未作答。" : "本卷所有题目均已有作答。") +
        '交卷后进入主观题与计算题自评。</p><div class="formactions"><button class="btn" data-action="close">返回作答</button><button class="btn primary" id="seal-exam">确认交卷</button></div>',
    );
    dlg.querySelector("#seal-exam").onclick = () => {
      stopClock();
      exam.phase = "review";
      save();
      close();
      ctx.render();
      window.scrollTo(0, 0);
    };
    return;
  }
  if (action === "score" && !locked) {
    if (
      exam.items.some(
        (s, j) =>
          !pending(j) &&
          (formOf(examQuestion(s)) === "written" ||
            examQuestion(s).type === "计算题") &&
          exam.scores[j] == null,
      )
    ) {
      ctx.toast("请先为已作答的简答与计算题给分");
      return;
    }
    locked = true;
    el.disabled = true;
    try {
      const { scores, total } = summary();
      for (const [j, s] of exam.items.entries()) {
        const q = examQuestion(s),
          d = exam.drafts[j] || {};
        const a = {
          bankRevision: s.legacyItem ? undefined : exam.bankVersion,
          qid: q.id,
          ...d,
          exam: true,
          seconds: Math.round((exam.times[j] || 0) / 1000),
          missed: pending(j),
        };
        if (formOf(q) === "written") a.grade = scores[j] === s.points;
        await ctx.add("attempt", a, s.token);
      }
      await ctx.add("exam", { total }, exam.id);
      exam.total = total;
      exam.finalScores = scores;
      exam.phase = "done";
      save();
      ctx.refresh();
      ctx.render();
      window.scrollTo(0, 0);
    } finally {
      locked = false;
      el.disabled = false;
    }
  }
}
