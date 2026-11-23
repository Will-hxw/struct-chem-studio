import {
  openInlineTutor,
  restoreInlineTutor,
  dismissDialogTutor,
} from "./inline-tutor.mjs";
import {
  esc,
  icon,
  chapter,
  chapters,
  types,
  letters,
  tag,
  pages,
  questionImages,
  difficulty,
  formOf,
  causes,
} from "./ui.mjs";
import {
  normalize,
  materialize,
  stats,
  plan,
  correct,
  numberValue,
} from "./engine.mjs";
import { rich, formula, markdown, questionStem } from "./deferred-notation.mjs";
import { buildRoundPlan } from "./round-plan.mjs";
import * as store from "./store.mjs";
import {
  modal,
  close,
  editor,
  importer,
  backup,
  configure,
} from "./editor.mjs";

import { typePage, reportPage, advice } from "./training.mjs";
import {
  labRoute,
  labTabs,
  labPage,
  labLink,
  visualFor,
  mountLab,
  labObservation,
} from "./lab.mjs";
import {
  tutorShell,
  mountTutor,
  generalTutor,
  questionTutor,
  labTutor,
  reviewTutor,
} from "./tutor.mjs?v=10";
import {
  setupExam,
  examPage,
  examAction,
  examInput,
  examVisibility,
} from "./exam.mjs";
import { sketchRender, attachSketch } from "./sketch.mjs";
import { makeOrders, ordered } from "./choice-order.mjs";
let drillType = "",
  drillLevel = 0,
  drillChapter = 0,
  clockStart = null;
function tickOff() {
  if (clockStart !== null && session) {
    session.times ??= {};
    const i = session.index;
    session.times[i] =
      (session.times[i] || 0) + Math.max(0, Date.now() - clockStart);
    clockStart = null;
    persist();
  }
}
function tickOn() {
  if (
    clockStart === null &&
    session &&
    view === "quiz" &&
    !document.hidden &&
    !lookupSessionAnswer(session.index)
  )
    clockStart = Date.now();
}
function eye() {
  if (document.hidden) {
    tickOff();
    examVisibility(false);
  } else {
    tickOn();
    examVisibility(view === "exam");
  }
}
document.addEventListener("visibilitychange", eye);
window.addEventListener("pagehide", () => {
  tickOff();
  examVisibility(false);
});
const host = document.getElementById("studio"),
  get = (id) => document.getElementById(id);
const button = (label, action, ic = "", style = "", attrs = "") =>
  '<button class="btn ' +
  style +
  '" data-action="' +
  action +
  '" ' +
  attrs +
  ">" +
  (ic ? icon(ic, 16) : "") +
  esc(label) +
  "</button>";
const textBtn = (label, action, attrs = "") =>
  '<button class="plain" data-action="' +
  action +
  '" ' +
  attrs +
  ">" +
  esc(label) +
  "</button>";
const ib = (ic, action, title, attrs = "", cls = "") =>
  '<button class="iconbtn ' +
  cls +
  '" data-action="' +
  action +
  '" aria-label="' +
  esc(title) +
  '" title="' +
  esc(title) +
  '" ' +
  attrs +
  ">" +
  icon(ic, 16) +
  "</button>";
const safeAttr = (name, val) => "data-" + name + '="' + esc(val) + '"';
const idAttr = (id) => safeAttr("id", id);
const opts = (values, cur) =>
  values
    .map(
      ([v, l]) =>
        '<option value="' +
        esc(v) +
        '" ' +
        (String(cur) === String(v) ? "selected" : "") +
        ">" +
        esc(l) +
        "</option>",
    )
    .join("");
const blockIcon = (ic, color, sz = 22) =>
  '<span class="iconblock ' + color + '">' + icon(ic, sz) + "</span>";
const empty = (ic, title, desc, cta = "") =>
  '<div class="empty">' +
  blockIcon(ic, "teal") +
  "<h3>" +
  esc(title) +
  '</h3><p class="muted">' +
  esc(desc) +
  "</p>" +
  cta +
  "</div>";
let seed = [],
  retired = [],
  legacy = { options: {}, changed: {}, revised: {}, replacements: {} },
  bankRevision = 3,
  refs = [],
  model,
  view = "home",
  syncLabel = "正在读取账号…",
  menu = false,
  refIdx = 0,
  guideCh = 0,
  guideMode = "公式",
  planCount = 10,
  displayedPlan = null,
  guideQuery = "",
  filter = { chapter: 0, type: "", topic: "", query: "", page: 1 },
  mistab = "pending",
  chapterDetail = 0,
  setupCount = 8;
let session = null,
  busy = false,
  toastTimer;
let labState = labRoute("molecule", "h2o"),
  labReturn = null,
  disposePage,
  disposeDialog,
  tutorContext = generalTutor,
  tutorReturn = null;
const labPath = (r) => "#lab/" + r.kind + "/" + r.preset;
function goLab(route, from = null) {
  labState = route;
  labReturn = from;
  close();
  navigate("lab", false);
}
function helpFor(q, attempt = null) {
  return (
    '<div class="question-tools">' +
    button(
      "追问本题",
      "ai-question",
      "spark",
      "small",
      idAttr(q.id) + ' data-mode="explain"',
    ) +
    (attempt && correct(q, attempt.data) === false
      ? button(
          "分析本次错因",
          "ai-question",
          "target",
          "small",
          idAttr(q.id) + ' data-mode="diagnose"',
        )
      : "") +
    button(
      "出一道变式",
      "ai-question",
      "repeat",
      "small",
      idAttr(q.id) + ' data-mode="variant"',
    ) +
    labLink(q) +
    "</div>"
  );
}
const persist = () => store.saveDraft("round", session);
const rebuild = () => {
  model = materialize(seed, store.events(), retired, legacy.changed, legacy.revised, legacy.replacements);
};
const today = () => new Date().toLocaleDateString("en-CA");
const todayCount = () =>
  model.graded.filter(
    (a) => new Date(a.at).toLocaleDateString("en-CA") === today(),
  ).length;
const latestWrong = (q) => model.hist.get(q.id)?.at(-1)?.ok === false;
const weak = () =>
  [...model.topics.values()]
    .filter((t) => t.k < t.n)
    .sort((a, b) => a.k / a.n - b.k / b.n || b.n - a.n);
const toast = (msg) => {
  const t = get("toast");
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.textContent = ""), 2900);
};
function head(name, desc, tool = "") {
  return (
    '<header class="pagehead"><div><h1>' +
    esc(name) +
    "</h1>" +
    (desc ? "<p>" + esc(desc) + "</p>" : "") +
    "</div>" +
    tool +
    "</header>"
  );
}
const head2 = (title, action = "") =>
  '<div class="sectionhead"><h2>' + title + "</h2>" + action + "</div>";
function navigate(page, reset = true) {
  if (!pages[page]) return;
  tickOff();
  examVisibility(false);
  if (reset) {
    filter = {
      chapter: 0,
      type: "",
      topic: "",
      query: "",
      page: 1,
    };
    if (page === "chapters") chapterDetail = 0;
    if (page === "types") drillType = "";
  }
  menu = false;
  view = page;
  const dest = page === "lab" ? labPath(labState) : "#" + page;
  if (location.hash !== dest) history.pushState({}, "", dest);
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function useHash() {
  tickOff();
  examVisibility(false);
  const [name, kind, preset] = location.hash.slice(1).split("/");
  view =
    name === "resources" ? "bank" : Object.hasOwn(pages, name) ? name : "home";
  if (view === "lab") labState = labRoute(kind, preset);
  if ((view === "quiz" || view === "result") && !session) view = "home";
  menu = false;
  render();
}
function side() {
  const active = view === "quiz" || view === "result" ? "chapters" : view;
  function n(key, ic) {
    return (
      '<button class="navbtn ' +
      (active === key ? "active" : "") +
      '" ' +
      (active === key ? 'aria-current="page"' : "") +
      ' data-action="nav" data-page="' +
      key +
      '">' +
      icon(ic) +
      pages[key] +
      (key === "mistakes" && model.qs.some(latestWrong)
        ? '<span class="count">' +
          model.qs.filter(latestWrong).length +
          "</span>"
        : "") +
      "</button>"
    );
  }
  const done = todayCount(),
    ratio = Math.min(100, Math.round((100 * done) / model.goal));
  return (
    '<aside class="sidebar" id="study-navigation" aria-label="主导航"><div class="brand"><img src="/favicon.svg" alt=""><div><strong>结构化学</strong><small>SC Lab</small></div><button class="iconbtn nav-close" data-action="menu" aria-label="关闭导航">' +
    icon("close", 18) +
    '</button></div><div class="sidegroup"><p>学习空间</p>' +
    n("home", "home") +
    n("plan", "repeat") +
    n("chapters", "book") +
    n("types", "target") +
    n("mistakes", "errors") +
    n("exam", "clock") +
    n("report", "chart") +
    '</div><div class="sidegroup"><p>复习工具</p>' +
    n("guide", "formula") +
    n("bank", "database") +
    n("lab", "molecule") +
    n("tutor", "spark") +
    '</div><div class="sidebottom"><div class="goalbox"><div>' +
    icon("target", 17) +
    '今日练习目标<button data-action="goal" title="设置每日目标" aria-label="设置每日目标">' +
    icon("pen", 13) +
    '</button></div><div class="goalprogress"><i style="width:' +
    ratio +
    '%"></i></div><div class="goallabel"><span>' +
    done +
    " / " +
    model.goal +
    " 题</span><span>" +
    ratio +
    '%</span></div></div><button class="profile account-button" type="button" data-action="account"><span class="avatar">' +
    icon("user", 18) +
    '</span><div class="profile-copy"><strong>我的账号</strong><small id="sync-indicator">' +
    esc(syncLabel) +
    '</small></div></button><footer class="author-credit">作者：<span lang="en">Hua Xiaowei —— ZJU</span></footer></div></aside>'
  );
}
function chapterCard(c, full = false) {
  const qs = model.qs.filter((q) => q.chapter === c.id),
    done = qs.filter((q) => model.hist.has(q.id)).length,
    rate = stats(
      model.graded.filter((a) => model.byId.get(a.qid)?.chapter === c.id),
    ).rate;
  return (
    '<button class="chaptercard" data-action="chapter" data-id="' +
    c.id +
    '"><div class="top">' +
    blockIcon(c.icon, c.color, 23) +
    '<div><span class="chapnum">' +
    c.label +
    "</span><h3>" +
    c.name +
    "</h3></div></div>" +
    (full ? "<p>" + c.desc + "</p>" : "") +
    '<div class="cardmeta"><span>共 ' +
    qs.length +
    " 题</span><span>" +
    (rate === null ? "尚未练习" : "正确率 " + rate + "%") +
    '</span></div><div class="bar" title="已练 ' +
    done +
    " / " +
    qs.length +
    ' 题"><i style="width:' +
    (qs.length ? (100 * done) / qs.length : 0) +
    '%"></i></div></button>'
  );
}
function guidespot() {
  const highlights = [
      refs[0],
      refs.find((r) => r.title === "分子轨道键级"),
      refs.find((r) => r.title === "原子轨道节点"),
    ].filter(Boolean),
    r = highlights[refIdx % highlights.length];
  return (
    '<div class="box">' +
    head2(
      icon("formula", 17) + " 公式速查",
      textBtn("全部", "nav", 'data-page="guide"'),
    ) +
    '<div class="guidepreview"><span class="dotlabel">' +
    esc(chapter(r.chapter).short) +
    '</span><span class="formula">' +
    formula(r.tex, true) +
    "</span><h3>" +
    esc(r.title) +
    '</h3><svg class="waveart" viewBox="0 0 110 86" fill="none" stroke="currentColor" stroke-width=".8" aria-hidden="true">' +
    Array.from(
      { length: 11 },
      (_, i) =>
        '<path d="M-8 ' +
        (65 + i * 1.4) +
        "C15 " +
        (67 - i) +
        ",22 " +
        (11 + i * 5) +
        ",47 " +
        (18 + i * 3) +
        "S73 " +
        (77 - i * 4) +
        ",114 " +
        (22 + i * 4) +
        '"/>',
    ).join("") +
    '</svg></div><div class="guidefoot"><span class="dots" aria-hidden="true">' +
    highlights
      .map((_, i) => '<i class="' + (i === refIdx ? "active" : "") + '"></i>')
      .join("") +
    "</span>" +
    textBtn("换一条", "ref-next") +
    "</div></div>"
  );
}
let revisedPlan = null;
function planPage() {
  const original = buildRoundPlan(model, planCount);
  displayedPlan =
    revisedPlan?.base === original.ids.join(",") ? revisedPlan.plan : original;
  const round = displayedPlan;
  let number = 0;
  const active = session && !session.done && session.ids.length;
  const sizeControl =
    '<label class="plan-size">题量<select id="plan-size">' +
    opts(
      [
        [5, "5 题"],
        [10, "10 题"],
        [15, "15 题"],
      ],
      planCount,
    ) +
    "</select></label>";
  const action = button(
    "开始这 " + round.ids.length + " 道题",
    "plan-start",
    "play",
    "primary",
  );
  const sections = round.groups
    .filter((g) => g.ids.length)
    .map((group) => {
      const rows = group.ids
        .map((id) => {
          const q = model.byId.get(id);
          const order = String(++number).padStart(2, "0");
          return (
            '<li><span class="plan-no">' +
            order +
            '</span><div><div class="plan-meta">' +
            esc(q.topic) +
            "<span>·</span>" +
            esc(q.type) +
            "<span>·</span>" +
            esc(difficulty[q.difficulty]) +
            "</div><p>" +
            rich(q.stem) +
            "</p></div></li>"
          );
        })
        .join("");
      return (
        '<section class="plan-section"><header><h2>' +
        esc(group.label) +
        "</h2><span>" +
        group.ids.length +
        ' 题</span></header><p class="group-reason">' +
        esc(group.reason) +
        '</p><ol class="plan-list">' +
        rows +
        "</ol></section>"
      );
    })
    .join("");
  return (
    head("下一轮题单", "题目已从你的题库选好。开始后会按下方顺序逐题作答。") +
    '<section class="plan-lead"><div><h2>' +
    esc(round.title) +
    "</h2><p>" +
    esc(round.intro) +
    '</p></div><div class="plan-actions">' +
    sizeControl +
    action +
    button("AI 调整题单", "ai-plan", "spark", "small") +
    (displayedPlan === revisedPlan?.plan
      ? button("恢复推荐题单", "plan-restore", "repeat", "small")
      : "") +
    "</div></section>" +
    (active
      ? '<div class="round-resume">进行中：' +
        esc(session.title) +
        " · 第 " +
        (session.index + 1) +
        " / " +
        session.ids.length +
        " 题 " +
        textBtn("继续上次练习", "resume") +
        "</div>"
      : "") +
    sections
  );
}
function recommendation() {
  if (session && !session.done)
    return {
      title: session.title,
      desc: "上次练到第 " + (session.index + 1) + " 题，继续完成这一轮练习。",
      count: session.ids.length,
      kind: "resume",
      cta: "继续练习",
      label: "进行中的练习",
    };
  return {
    title: model.graded.length ? "你的下一轮题单" : "第一轮基础诊断",
    desc: model.graded.length
      ? "按本次记录回练错题，补测练得少的知识点。"
      : "先从各章选几道基础题，找出需要多练的地方。",
    count: Math.min(10, model.qs.length),
    kind: "plan",
    cta: "查看题单",
    label: "下一轮练习",
  };
}
function dashboard() {
  const r = recommendation(),
    s = stats(model.graded);
  const metrics = [
    ["book", "teal", "已练题目", model.hist.size, "题"],
    [
      "target",
      "lavender",
      "累计正确率",
      s.rate ?? "—",
      s.rate === null ? "" : "%",
    ],
    ["errors", "red", "待巩固错题", model.qs.filter(latestWrong).length, "题"],
    ["star", "amber", "我的收藏", model.favs.size, "题"],
  ];
  const w = weak().slice(0, 3);
  return (
    head(
      "复习工作台",
      "查看学习进度，开始今天的结构化学练习。",
      button("录入新题", "new", "plus"),
    ) +
    '<section class="hero"><div class="hero-copy"><span class="recommend">' +
    icon("spark", 14) +
    r.label +
    "</span><h2>" +
    esc(r.title) +
    "</h2><p>" +
    esc(r.desc) +
    '</p><div class="herofoot">' +
    button(r.cta, "recommended", "play", "primary") +
    '<span class="metaitem">' +
    icon("note", 14) +
    r.count +
    ' 道题</span><span class="metaitem">' +
    icon("clock", 14) +
    "约 " +
    r.count +
    ' 分钟</span></div></div><img class="heroart" src="/media/benzene.svg" alt="苯的六碳六氢球棍模型，点群 D₆h"></section>' +
    '<section class="stats" aria-label="学习统计">' +
    metrics
      .map(
        ([ic, col, l, v, u]) =>
          '<div class="stat">' +
          blockIcon(ic, col, 21) +
          '<div><div class="stat-label">' +
          l +
          '</div><div class="stat-number"><b>' +
          v +
          "</b><small>" +
          u +
          "</small></div></div></div>",
      )
      .join("") +
    "</section>" +
    '<div class="dashbody"><section>' +
    head2(
      "章节练习",
      '<span class="info">8 个专题 · ' + model.qs.length + " 道题</span>",
    ) +
    '<div class="chaptergrid">' +
    chapters.map((c) => chapterCard(c)).join("") +
    '</div></section><aside class="rail">' +
    '<div class="box lab-launch"><span class="iconblock teal">' +
    icon("molecule", 21) +
    "</span><div><h3>分子点群实验台</h3><p>对照 H₂O 和 HOCl，检验旋转后哪些原子重合。</p></div>" +
    button("观察三维结构", "open-lab", "molecule", "small") +
    "</div>" +
    guidespot() +
    '<div class="box">' +
    head2(icon("chart", 17) + " 薄弱知识点") +
    (w.length
      ? w
          .map(
            (t) =>
              '<button class="weakrow" data-action="topic-round" ' +
              safeAttr("topic", t.topic) +
              ' data-ch="' +
              t.chapter +
              '"><span>' +
              esc(t.topic) +
              "</span><b>" +
              Math.round((100 * t.k) / t.n) +
              "%</b></button>",
          )
          .join("")
      : '<div class="weakempty">' +
        blockIcon("compass", "teal", 19) +
        "<span>" +
        (s.n
          ? "目前已练知识点均答对。"
          : "完成练习后，在这里查看需要巩固的知识点。") +
        "</span></div>") +
    "</div></aside></div>"
  );
}
function allChapters() {
  if (chapterDetail) {
    const c = chapter(chapterDetail),
      pool = model.qs.filter((q) => q.chapter === c.id);
    return (
      head(c.name, c.desc, button("所有章节", "all-chapters", "book")) +
      '<div class="box">' +
      head2("专项练习", tag(pool.length + " 道题")) +
      setupForm(pool) +
      "</div>" +
      head2Inner("本章题目") +
      pool.map(questionRow).join("")
    );
  }
  return (
    head(
      "章节练习",
      "选择一个专题，按知识点和题型组织练习。",
      button("智能组卷", "adaptive", "spark", "primary"),
    ) +
    '<div class="chaptergrid chapterpage">' +
    chapters.map((c) => chapterCard(c, true)).join("") +
    "</div>" +
    method()
  );
}
function head2Inner(t) {
  return '<div class="sectionhead inner"><h2>' + esc(t) + "</h2></div>";
}
function setupForm(pool) {
  return (
    '<div class="filters"><select id="setup-type" aria-label="练习题型">' +
    opts(
      [
        ["", "全部题型"],
        ...[...new Set(pool.map((q) => q.type))].map((t) => [t, t]),
      ],
      "",
    ) +
    '</select><select id="setup-topic" aria-label="练习知识点">' +
    opts(
      [
        ["", "全部知识点"],
        ...[...new Set(pool.map((q) => q.topic))].map((t) => [t, t]),
      ],
      "",
    ) +
    '</select><select id="setup-n" aria-label="练习题数">' +
    opts(
      [
        [5, "5 题"],
        [8, "8 题"],
        [15, "15 题"],
        [1000, "全部题目"],
      ],
      setupCount,
    ) +
    "</select>" +
    button("开始本章练习", "start-chapter", "play", "primary") +
    '</div><p id="pool-info" class="muted">本章可选 ' +
    pool.length +
    " 道题，题量少于设定值时使用全部匹配题。</p>"
  );
}
function method() {
  return '<details class="method"><summary>下一轮练习怎样选题？</summary><p>先根据各知识点累计正确率排序，优先选择最近答错和较久未练的题，再加入未练题。刚刚答对的题会降低优先级，同一轮中每道题只出现一次。</p></details>';
}
const originTag = (q) => tag(q.origin);
const hintMethods = {
  1: "先写出有关定义或算符作用式，再代入题设的边界、量子数或单位。",
  2: "先认出组态或轨道的 n、l、m。若涉及概率，先区分点密度和径向分布。",
  3: "先看电子组态与占据。涉及光谱时先写能级差和对应的选择定则。",
  4: "画构型，先找主轴，再依次检查垂直副轴、镜面和反演中心。",
  5: "先数参与共轭的原子与电子，画出相邻连接，再判能级和占据。",
  6: "只取未闭壳层。若是等价电子，先用泡利原理限制允许占据。",
  7: "画常规晶胞，区分阵点与结构基元。分别核对共享权重、距离和单位。",
  8: "先按配体电荷确定中心离子的氧化态和 d 电子数，再画能级分裂图。",
};
function practiceHint(q) {
  return (
    '<details class="practice-hint"><summary>查看提示</summary><p>' +
    rich(q.hint || hintMethods[q.chapter]) +
    '</p><div class="question-tools">' +
    button(
      "继续问 AI",
      "ai-question",
      "spark",
      "small",
      idAttr(q.id) + ' data-mode="hint"',
    ) +
    "</div></details>"
  );
}
function questionRow(q) {
  const last = model.hist.get(q.id)?.at(-1);
  return (
    '<article class="qrow"><button class="questionopen" data-action="detail" ' +
    idAttr(q.id) +
    '><div class="chips">' +
    tag(chapter(q.chapter).short) +
    tag(q.type, "lav") +
    tag(difficulty[q.difficulty]) +
    tag(q.topic) +
    originTag(q) +
    (last
      ? tag(last.ok ? "上次正确" : "待巩固", last.ok ? "good" : "bad")
      : "") +
    "</div><h3>" +
    rich(q.stem) +
    "</h3></button>" +
    ib(
      "star",
      "favorite",
      model.favs.has(q.id) ? "取消收藏" : "收藏题目",
      idAttr(q.id),
      model.favs.has(q.id) ? "savedstar" : "",
    ) +
    ib("pen", "edit", "编辑题目与答案", idAttr(q.id)) +
    "</article>"
  );
}
function filters(pool) {
  const topics = [
    ...new Set(
      pool
        .filter((q) => !filter.chapter || q.chapter === +filter.chapter)
        .map((q) => q.topic),
    ),
  ].sort((a, b) => a.localeCompare(b, "zh"));
  return (
    '<div class="filters"><label class="searchfield">' +
    icon("search", 17) +
    '<input id="query" aria-label="搜索题目、知识点或题号" value="' +
    esc(filter.query) +
    '" placeholder="搜索题目、知识点或题号"></label><select aria-label="筛选章节" id="filter-ch">' +
    opts(
      [[0, "全部章节"], ...chapters.map((c) => [c.id, c.name])],
      filter.chapter,
    ) +
    '</select><select aria-label="筛选题型" id="filter-type">' +
    opts([["", "全部题型"], ...types.map((t) => [t, t])], filter.type) +
    '</select><select aria-label="筛选知识点" id="filter-topic">' +
    opts([["", "全部知识点"], ...topics.map((t) => [t, t])], filter.topic) +
    "</select></div>"
  );
}
function matches(q) {
  const query = filter.query.toLocaleLowerCase().trim();
  return (
    (!+filter.chapter || q.chapter === +filter.chapter) &&
    (!filter.type || q.type === filter.type) &&
    (!filter.topic || q.topic === filter.topic) &&
    (!query ||
      [q.id, q.stem, q.topic, ...q.options]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query))
  );
}
function baseList() {
  return model.qs.filter(
    (q) =>
      view !== "mistakes" ||
      (mistab === "fav"
        ? model.favs.has(q.id)
        : mistab === "mastered"
          ? model.hist.get(q.id)?.some((a) => !a.ok) && !latestWrong(q)
          : latestWrong(q)),
  );
}
function recordList() {
  const pool = baseList().filter(matches),
    pagesNum = Math.max(1, Math.ceil(pool.length / 10));
  filter.page = Math.min(filter.page, pagesNum);
  return (
    '<div class="sectionhead"><div class="muted">共 ' +
    pool.length +
    " 道题</div>" +
    ((view === "mistakes" || pool.length < model.qs.length) && pool.length
      ? button("练习筛选结果", "start-filter", "play", "small")
      : "") +
    "</div>" +
    (pool.length
      ? pool
          .slice((filter.page - 1) * 10, filter.page * 10)
          .map(questionRow)
          .join("")
      : empty(
          view === "bank" ? "search" : mistab === "fav" ? "star" : "errors",
          view === "bank"
            ? "没有匹配的题目"
            : mistab === "fav"
              ? "暂无收藏题目"
              : mistab === "mastered"
                ? "暂无已订正错题"
                : "暂无待巩固错题",
          view === "bank"
            ? "调整筛选条件，或录入一道新题。"
            : mistab === "fav"
              ? "点击题目旁的星标即可收藏。"
              : "练习后，这里会按最近一次作答更新。",
        )) +
    (pagesNum > 1
      ? '<div class="pager">' +
        button(
          "上一页",
          "prev-page",
          "",
          "small",
          filter.page === 1 ? "disabled" : "",
        ) +
        "<span>" +
        filter.page +
        " / " +
        pagesNum +
        "</span>" +
        button(
          "下一页",
          "next-page",
          "",
          "small",
          filter.page === pagesNum ? "disabled" : "",
        ) +
        "</div>"
      : "")
  );
}
function bank() {
  return (
    head(
      "题库管理",
      "",
      '<div class="tools">' +
        button("导入题目", "import", "upload") +
        button("录入新题", "new", "plus", "primary") +
        "</div>",
    ) +
    filters(model.qs) +
    '<div id="records">' +
    recordList() +
    '</div><div class="tools">' +
    textBtn("导出学习备份", "backup") +
    textBtn("恢复备份", "import") +
    "</div>"
  );
}
function mistakes() {
  return (
    head("错题与收藏", "答错的题目自动收录，再次答对后进入「已订正」。") +
    '<div class="tabs">' +
    [
      ["pending", "待巩固"],
      ["mastered", "已订正"],
      ["fav", "我的收藏"],
    ]
      .map(
        ([k, l]) =>
          '<button data-action="mistab" data-id="' +
          k +
          '" class="tab ' +
          (k === mistab ? "active" : "") +
          '">' +
          l +
          "</button>",
      )
      .join("") +
    "</div>" +
    filters(baseList()) +
    '<div id="records">' +
    recordList() +
    "</div>"
  );
}
function guide() {
  const visible = refs.filter(
    (r) =>
      (!guideCh || r.chapter === guideCh) &&
      [r.title, r.detail, r.pitfall, r.formula].join(" ").includes(guideQuery),
  );
  return (
    head("知识速查", "查公式的适用条件，也查容易混淆的判断依据。") +
    '<div class="filters"><label class="searchfield">' +
    icon("search", 17) +
    '<input id="guide-query" value="' +
    esc(guideQuery) +
    '" placeholder="搜索公式或易错点" aria-label="搜索公式或易错点"></label><select id="guide-ch" aria-label="速查章节">' +
    opts([[0, "全部章节"], ...chapters.map((c) => [c.id, c.name])], guideCh) +
    '</select></div><div class="tabs">' +
    ["公式", "易错点"]
      .map(
        (k) =>
          '<button class="tab ' +
          (k === guideMode ? "active" : "") +
          '" data-action="guide-mode" ' +
          idAttr(k) +
          ">" +
          k +
          "</button>",
      )
      .join("") +
    "</div>" +
    (visible.length
      ? '<div class="referencegrid">' +
        visible
          .map(
            (r) =>
              '<article class="box refcard">' +
              tag(chapter(r.chapter).short) +
              "<h3>" +
              esc(r.title) +
              "</h3>" +
              (guideMode === "公式"
                ? '<div class="formula-band">' +
                  formula(r.tex, true) +
                  "</div><p>" +
                  rich(r.detail) +
                  '</p><div class="tip"><strong>易错点</strong>' +
                  rich(r.pitfall) +
                  "</div>"
                : '<div class="tip">' +
                  rich(r.pitfall) +
                  "</div><p>" +
                  rich(r.detail) +
                  "</p>") +
              "</article>",
          )
          .join("") +
        "</div>"
      : empty(
          "search",
          "没有匹配的速查条目",
          "可以换用知识点名称或缩短关键词。",
        )) +
    '<details class="method"><summary>参考资料</summary><p class="sourcelinks"><a href="https://openstax.org/books/chemistry-2e/pages/8-4-molecular-orbital-theory" target="_blank" rel="noreferrer">OpenStax 分子轨道理论</a><a href="https://chem.libretexts.org/Ancillary_Materials/Reference/Reference_Tables/Group_Theory_Tables" target="_blank" rel="noreferrer">LibreTexts 群论参考表</a><a href="https://doi.org/10.1037/stl0000024" target="_blank" rel="noreferrer">练习测验与间隔复习</a></p></details>'
  );
}
function lookupSessionAnswer(ix) {
  const id = session?.tokens[ix];
  return id
    ? store.events().find((e) => e.id === id && e.kind === "attempt")
    : null;
}
function roundQuestion(i) {
  const id = session?.ids[i];
  return ordered(model.byId.get(id), session?.orders?.[id]);
}
function upgradeRound() {
  if (!session || session.bankVersion >= bankRevision) return;
  const usesIndex = !session.bankVersion || session.bankVersion < 3;
  const custom = new Set(
    store
      .events()
      .filter((e) => e.kind === "question")
      .map((e) => e.data.id),
  );
  session.orders ??= {};
  for (const [i, id] of session.ids.entries()) {
    const q = model.byId.get(id);
    if (!q) continue;
    const old = (!custom.has(id) && legacy.options[id]) || q.options;
    if (usesIndex && old.length) session.orders[id] = old;
    if (Array.isArray(session.draft[i]))
      session.draft[i] = session.draft[i]
        .map((j) => (typeof j === "number" ? old[j] : j))
        .filter((x) => q.options.includes(x));
    if (legacy.revised[id] && !custom.has(id) && !lookupSessionAnswer(i)) {
      delete session.revealed[i];
      delete session.text[i];
      if (session.sketches) delete session.sketches[i];
    }
  }
  session.bankVersion = bankRevision;
  persist();
}
function start(pool, title, count = 8, ladder = false, fixedIds = null) {
  if (!pool.length) {
    toast("当前条件下没有可练习题目");
    return;
  }
  const begin = () => {
    tickOff();
    let ids = fixedIds ? [...fixedIds] : plan(pool, model, count);
    if (ladder && !fixedIds) {
      ids = [];
      const allLevels = [1, 2, 3].filter((l) =>
        pool.some((q) => q.difficulty === l),
      );
      let limits = allLevels.map(
        (l, i) =>
          Math.floor(count / allLevels.length) +
          (i < count % allLevels.length ? 1 : 0),
      );
      for (let i = 0; i < allLevels.length; i++)
        ids.push(
          ...plan(
            pool.filter((q) => q.difficulty === allLevels[i]),
            model,
            limits[i],
          ),
        );
      if (ids.length < count)
        ids.push(
          ...plan(
            pool.filter((q) => !ids.includes(q.id)),
            model,
            count - ids.length,
          ),
        );
      ids.sort(
        (a, b) => model.byId.get(a).difficulty - model.byId.get(b).difficulty,
      );
    }
    session = {
      bankVersion: bankRevision,
      orders: makeOrders(ids.map((id) => model.byId.get(id))),
      title,
      ids,
      tokens: ids.map(() => crypto.randomUUID()),
      index: 0,
      draft: {},
      text: {},
      revealed: {},
      times: {},
      sketches: {},
      hints: {},
      done: false,
    };
    persist();
    navigate("quiz");
  };
  if (
    session &&
    !session.done &&
    session.ids.some((_, i) => !lookupSessionAnswer(i))
  ) {
    const d = modal(
      "开始新一轮练习？",
      '<p class="muted">当前一轮的已提交作答已计入学习记录。开始新练习将替换未完成的练习进度。</p><div class="formactions">' +
        button("继续当前练习", "resume") +
        button("开始新练习", "confirm-round", "play", "primary") +
        "</div>",
    );
    d.querySelector('[data-action="confirm-round"]').onclick = () => {
      close();
      begin();
    };
    return;
  }
  begin();
}
function reasonPicker(attempt) {
  if (
    !attempt ||
    correct(model.byId.get(attempt.data.qid), attempt.data) !== false
  )
    return "";
  const chosen = model.reasons.get(attempt.id);
  return (
    '<div class="reasonbox"><strong>这次错在哪里？</strong><div class="tools">' +
    causes
      .map(
        (x) =>
          '<button class="reasonchip ' +
          (chosen === x ? "active" : "") +
          '" data-action="reason" data-at="' +
          esc(attempt.id) +
          '" data-cause="' +
          esc(x) +
          '">' +
          esc(x) +
          "</button>",
      )
      .join("") +
    "</div>" +
    (chosen ? "<p>" + esc(advice[chosen]) + "</p>" : "") +
    "</div>"
  );
}
function attemptResult(q, attempt) {
  return model.hist.get(q.id)?.find((a) => a.id === attempt.id)?.ok
    ?? correct(q, attempt.data);
}
function answerInfo(q, attempt = null) {
  const archivedAttempt =
    attempt &&
    model.hist.get(q.id)?.find((a) => a.id === attempt.id)?.historical;
  if (archivedAttempt) attempt = null;
  const ok = attempt ? correct(q, attempt.data) : null,
    mode = formOf(q),
    response =
      mode === "choice"
        ? q.answers.map((i) => letters[i]).join("、")
        : mode === "number"
          ? q.value + " " + q.unit
          : mode === "blank"
            ? q.accepted.join(" / ")
            : "";
  return (
    '<div class="answerinfo">' +
    (archivedAttempt
      ? '<p class="formhint">此前作答已按当时题面计入记录。这里显示修订后的题目与解析。</p>'
      : "") +
    (attempt
      ? '<span class="feedback ' +
        (ok ? "" : "incorrect") +
        '">' +
        icon(ok ? "check" : "info", 18) +
        " " +
        (mode === "written"
          ? ok
            ? "自评已掌握"
            : "自评待巩固"
          : ok
            ? "回答正确"
            : "回答有误") +
        "</span> "
      : "") +
    (mode === "written"
      ? tag("参考答案")
      : '<span class="tag good">正确答案 ' + rich(response) + "</span>") +
    '<div class="explain-copy">' +
    markdown(q.explanation || "尚未录入解析，可在题库管理中补充。", true) +
    "</div>" +
    questionImages(q, "solution") +
    (q.id === "course-35" || q.id === "course-36"
      ? '<details class="method"><summary>查看原题配图</summary><img class="questionimg" src="/api/figure/' +
        (q.id === "course-35" ? "mo-diagram" : "h2-curve") +
        '" alt="原题配图"></details>'
      : "") +
    (q.url && !seed.some((s) => s.id === q.id)
      ? '<p><a href="' +
        esc(q.url) +
        '" target="_blank" rel="noreferrer">参考课程材料</a></p>'
      : "") +
    (q.rubric.length
      ? '<div class="rubric"><strong>评分点</strong><ol>' +
        q.rubric.map((x) => "<li>" + rich(x) + "</li>").join("") +
        "</ol></div>"
      : "") +
    (q.pitfall
      ? '<div class="tip"><strong>易错点</strong>' + rich(q.pitfall) + "</div>"
      : "") +
    reasonPicker(attempt) +
    helpFor(q, attempt) +
    "</div>"
  );
}
function detail(id) {
  const q = model.byId.get(id);
  if (!q) return;
  modal(
    "题目详情",
    '<div class="chips">' +
      tag(chapter(q.chapter).name) +
      tag(q.type, "lav") +
      tag(q.topic) +
      originTag(q) +
      "</div>" +
      questionStem(q.stem, "h3", "detailstem") +
      questionImages(q) +
      q.options
        .map(
          (o, i) =>
            '<div class="readoption ' +
            (q.answers.includes(i) ? "right" : "") +
            '"><span class="letter">' +
            letters[i] +
            "</span>" +
            rich(o) +
            "</div>",
        )
        .join("") +
      answerInfo(
        q,
        store
          .events()
          .filter((e) => e.kind === "attempt" && e.data.qid === q.id)
          .sort((a, b) => b.at - a.at)[0],
      ) +
      '<p class="source">' +
      esc(q.source) +
      '</p><div class="formactions">' +
      button("编辑答案", "edit", "pen", "", idAttr(q.id)) +
      button("练习此题", "single", "play", "primary", idAttr(q.id)) +
      "</div>",
  );
}
function quiz() {
  if (!session) return "";
  const i = session.index,
    q = roundQuestion(i);
  if (!q) return empty("info", "本轮题目尚未载入", "可从题库重新开始练习。");
  const attempt = lookupSessionAnswer(i),
    selected = session.draft[i] || [],
    revealed = !!attempt || session.revealed[i],
    mode = formOf(q),
    isFree = mode === "written";
  const done = session.ids.filter((_, j) => lookupSessionAnswer(j)).length;
  const isDraw = q.type === "作图题" || q.draw,
    textValue = attempt?.data.text ?? session.text[i] ?? "",
    frozen = revealed ? "readonly" : "";
  const area =
    mode === "choice"
      ? q.options
          .map((o, j) => {
            const isSelected = attempt
              ? attempt.data.choice?.includes(o)
              : selected.includes(o);
            return (
              '<button class="option ' +
              (isSelected ? "selected " : "") +
              (attempt
                ? q.answers.includes(j)
                  ? "right"
                  : isSelected
                    ? "wrong"
                    : ""
                : "") +
              '" data-action="choose" data-index="' +
              j +
              '" aria-pressed="' +
              !!isSelected +
              '" ' +
              (attempt ? "disabled" : "") +
              '><span class="letter">' +
              letters[j] +
              "</span><span>" +
              rich(o) +
              "</span></button>"
            );
          })
          .join("")
      : (isDraw ? sketchRender() : "") +
        '<label class="formlabel">' +
        (mode === "number"
          ? "计算结果" + (q.unit ? "（" + rich(q.unit) + "）" : "")
          : mode === "blank"
            ? "填入答案"
            : isDraw
              ? "图示说明（可选）"
              : "我的作答") +
        '<textarea rows="' +
        (isFree ? 4 : 2) +
        '" id="q-text" ' +
        frozen +
        ' placeholder="' +
        (mode === "number"
          ? "输入数值；可使用科学计数法或分数"
          : mode === "blank"
            ? "输入简短标准答案"
            : "写下你的判断、推导或图示说明") +
        '">' +
        esc(textValue) +
        "</textarea></label>" +
        (mode === "number"
          ? '<p class="formhint">' +
            (q.tolerance
              ? "允许绝对误差 ±" + esc(q.tolerance) + " " + rich(q.unit)
              : "按题干单位填写数值") +
            "</p>"
          : "");
  const pending = session.ids.findIndex((_, j) => !lookupSessionAnswer(j));
  let action;
  if (attempt) {
    action = button(
      done === session.ids.length
        ? "查看本轮结果"
        : i === session.ids.length - 1
          ? "继续未答题目"
          : "下一题",
      "next",
      "",
      "primary",
    );
  } else if (isFree) {
    action = revealed
      ? '<div class="tools">' +
        button("仍需巩固", "grade", "", "", 'data-ok="0"') +
        button("已掌握", "grade", "check", "primary", 'data-ok="1"') +
        "</div>"
      : button(
          "查看参考答案",
          "reveal",
          "",
          "primary",
          session.text[i]?.trim() || session.sketches?.[i]?.length
            ? ""
            : "disabled",
        );
  } else
    action = button(
      "提交答案",
      "submit",
      "check",
      "primary",
      (mode === "choice" ? selected.length : session.text[i]?.trim())
        ? ""
        : "disabled",
    );
  return (
    head(
      session.title,
      "第 " +
        (i + 1) +
        " / " +
        session.ids.length +
        " 题 · " +
        chapter(q.chapter).name,
      button("保存并退出", "leave", "panel"),
    ) +
    '<div class="quizlayout"><section class="box quizcard"><div class="rowbetween"><div class="chips">' +
    tag(q.type, "lav") +
    tag(q.topic) +
    tag(difficulty[q.difficulty]) +
    originTag(q) +
    "</div>" +
    ib(
      "star",
      "favorite",
      model.favs.has(q.id) ? "取消收藏" : "收藏题目",
      idAttr(q.id),
      model.favs.has(q.id) ? "savedstar" : "",
    ) +
    "</div>" +
    questionStem(q.stem) +
    questionImages(q) +
    area +
    (revealed ? answerInfo(q, attempt) : practiceHint(q)) +
    '<div class="quizbottom">' +
    (i > 0 ? button("上一题", "previous", "", "small") : "<span></span>") +
    action +
    '</div><p class="source">' +
    esc(q.source) +
    '</p></section><aside class="box quizaside">' +
    head2("答题进度") +
    '<p class="muted">已提交 ' +
    done +
    " / " +
    session.ids.length +
    ' 题</p><div class="bar"><i style="width:' +
    (100 * done) / session.ids.length +
    '%"></i></div><div class="questionmap">' +
    session.ids
      .map((_, j) => {
        const a = lookupSessionAnswer(j),
          r = a ? attemptResult(roundQuestion(j), a) : null;
        return (
          '<button class="' +
          (i === j ? "current " : "") +
          (r === true ? "right" : r === false ? "wrong" : "") +
          '" data-action="jump" data-index="' +
          j +
          '" aria-label="第 ' +
          (j + 1) +
          " 题，" +
          (r === null ? "未提交" : r ? "正确" : "错误") +
          '">' +
          (j + 1) +
          "</button>"
        );
      })
      .join("") +
    '</div><p class="formhint">选中题号可直接跳题，进度自动保存。</p>' +
    (pending < 0 ? button("查看结果", "finish", "", "small") : "") +
    "</aside></div>"
  );
}
function results() {
  if (!session) return "";
  let attempts = session.ids
    .map((_, i) => {
      const a = lookupSessionAnswer(i);
      const q = roundQuestion(i);
      return a ? { q, ok: attemptResult(q, a) } : null;
    })
    .filter(Boolean);
  const rate = stats(attempts);
  return (
    head("本轮练习结果", session.title) +
    '<div class="box"><div class="rowbetween"><div>' +
    tag("本轮正确率", "good") +
    '<div class="resultscore">' +
    (rate.rate ?? "—") +
    '%</div><p class="muted">答对 ' +
    rate.k +
    " 题，共提交 " +
    rate.n +
    " 题。错题已计入下一轮选题。</p></div>" +
    blockIcon("target", "teal", 25) +
    '</div><div class="tools" style="margin-top:18px">' +
    button("生成下一轮练习", "adaptive", "spark", "primary") +
    button("回到总览", "nav", "home", "", 'data-page="home"') +
    "</div>" +
    method() +
    "</div>" +
    head2Inner("逐题回顾") +
    attempts
      .map(
        ({ q, ok }, i) =>
          '<div class="qrow">' +
          tag(ok ? "正确" : "错误", ok ? "good" : "bad") +
          '<button class="questionopen" data-action="detail" ' +
          idAttr(q.id) +
          "><h3>" +
          (i + 1) +
          ". " +
          rich(q.stem) +
          "</h3></button></div>",
      )
      .join("")
  );
}
const renderers = {
  home: dashboard,
  plan: planPage,
  chapters: allChapters,
  mistakes,
  guide,
  bank,
  quiz,
  result: results,
  report: () =>
    reportPage(model) +
    '<div class="tools">' +
    button("AI 复习建议", "ai-review", "spark", "small") +
    "</div>",
  types: () => typePage(model, drillType, drillLevel, drillChapter),
  lab: () => labPage(labState, labReturn),
  tutor: () => tutorShell(tutorReturn),
  exam: examPage,
};
function render() {
  if (!model) return;
  disposePage?.();
  disposePage = null;
  const now = new Date(),
    date = now.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    day = now.toLocaleDateString("zh-CN", { weekday: "long" });
  host.innerHTML =
    '<div class="shell ' +
    (menu ? "menuopen" : "") +
    '">' +
    side() +
    '<button class="mobile-dim" aria-label="关闭导航" tabindex="-1" data-action="menu"></button><div class="workspace"><header class="topbar"><div class="crumb"><button class="iconbtn menu-btn" aria-label="打开导航" aria-controls="study-navigation" aria-expanded="false" data-action="menu">' +
    icon("menu", 17) +
    "</button>" +
    icon("panel", 16) +
    "<span>学习空间</span><i>/</i><b>" +
    esc(pages[view]) +
    '</b></div><time class="date">' +
    icon("cal", 15) +
    "<span>" +
    date +
    '</span><span class="weekday">' +
    day +
    '</span></time></header><main class="main" id="main-content">' +
    renderers[view]() +
    "</main></div></div>";
  restoreInlineTutor(host);
  if (view === "lab")
    disposePage = mountLab(get("lab-stage"), labState, (preset) => {
      labState = labRoute(labState.kind, preset);
      history.replaceState({}, "", labPath(labState));
    });
  if (view === "tutor")
    disposePage = mountTutor(get("tutor-main"), tutorContext);
  if (view === "quiz" && session) {
    tickOn();
    const q = roundQuestion(session.index);
    if (q && (q.type === "作图题" || q.draw)) {
      const i = session.index,
        attempt = lookupSessionAnswer(i);
      session.sketches ??= {};
      attachSketch(
        attempt?.data.sketch || session.sketches[i] || [],
        !!attempt || !!session.revealed[i],
        (paths) => {
          session.sketches[i] = paths;
          persist();
          const b = document.querySelector('[data-action="reveal"]');
          if (b) b.disabled = !paths.length && !session.text[i]?.trim();
        },
      );
    }
  }
}
async function submit(grade) {
  if (busy) return;
  const i = session.index,
    q = roundQuestion(i);
  if (lookupSessionAnswer(i)) return;
  const mode = formOf(q);
  if (mode === "number" && numberValue(session.text[i]) === null) {
    toast("请输入有效数值，例如 2.5、1/2 或 3.2e−19");
    return;
  }
  tickOff();
  const d = {
    bankRevision,
    qid: q.id,
    seconds: Math.round((session.times?.[i] || 0) / 1000),
    ...(mode === "choice"
      ? {
          choice: (session.draft[i] || []).filter((x) => q.options.includes(x)),
        }
      : { text: (session.text[i] || "").trim() }),
    ...(mode === "written"
      ? { grade, sketch: session.sketches?.[i] || [] }
      : {}),
  };
  if (mode === "choice" && !d.choice.length) return;
  busy = true;
  try {
    await store.add("attempt", d, session.tokens[i]);
    rebuild();
    render();
  } finally {
    busy = false;
  }
}
function filteredChapter() {
  return model.qs.filter(
    (q) =>
      q.chapter === chapterDetail &&
      (!get("setup-type")?.value || q.type === get("setup-type").value) &&
      (!get("setup-topic")?.value || q.topic === get("setup-topic").value),
  );
}
function move(i) {
  tickOff();
  session.index = i;
  persist();
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function finish() {
  if (!session.ids.every((_, i) => lookupSessionAnswer(i))) {
    toast("请先提交本轮所有题目");
    return;
  }
  session.done = true;
  persist();
  navigate("result");
}
async function handle(el) {
  let { action, id, page, index, topic, ch } = el.dataset;
  if (action.startsWith("exam-")) {
    await examAction(action.slice(5), el);
    return;
  }
  switch (action) {
    case "open-lab":
      goLab(labRoute("molecule", "hocl"));
      break;
    case "question-lab": {
      const q = model.byId.get(id),
        r = q && visualFor(q);
      if (r) goLab(r, { page: view, id, detail: !!get("studio-dialog")?.open });
      break;
    }
    case "lab-tab":
      if (Object.hasOwn(labTabs, el.dataset.kind))
        goLab(labRoute(el.dataset.kind), labReturn);
      break;
    case "lab-back": {
      const r = labReturn;
      labReturn = null;
      navigate(r?.page && pages[r.page] ? r.page : "bank", false);
      if (r?.detail) detail(r.id);
      break;
    }
    case "ai-question": {
      const inRound =
        view === "quiz" &&
        session?.ids[session.index] === id &&
        !get("studio-dialog")?.open;
      const q = inRound ? roundQuestion(session.index) : model.byId.get(id);
      if (!q) break;
      const m = el.dataset.mode;
      const a =
        view === "quiz" && session?.ids[session.index] === q.id
          ? lookupSessionAnswer(session.index)
          : null;
      const entry =
        view === "quiz"
          ? a
            ? { ...a.data, reason: model.reasons.get(a.id) }
            : null
          : model.hist.get(id)?.at(-1);
      openInlineTutor(
        questionTutor(q, entry?.historical ? null : entry, m),
        el,
      );
      break;
    }
    case "ai-plan": {
      const round = displayedPlan;
      const base = buildRoundPlan(model, planCount).ids.join(",");
      const candidates = [
        ...new Set([...round.ids, ...buildRoundPlan(model, planCount + 5).ids]),
      ];
      if (!candidates.length) break;
      openInlineTutor(
        reviewTutor(model, round, candidates, (ids) => {
          revisedPlan = {
            base,
            plan: {
              title: "AI 调整后的题单",
              intro: "检查下方题目，确认后开始练习。",
              ids,
              groups: [
                {
                  label: "调整结果",
                  reason: "按当前学习记录和本轮目标，从现有题库选出。",
                  ids,
                },
              ],
            },
          };
          render();
        }),
        el,
      );
      break;
    }
    case "ai-review":
      openInlineTutor(reviewTutor(model, buildRoundPlan(model, planCount)), el);
      break;
    case "plan":
      navigate("plan");
      break;
    case "plan-restore":
      revisedPlan = null;
      render();
      break;
    case "plan-start":
      if (displayedPlan?.ids.length)
        start(
          displayedPlan.ids.map((id) => model.byId.get(id)).filter(Boolean),
          displayedPlan.title,
          displayedPlan.ids.length,
          false,
          displayedPlan.ids,
        );
      break;
    case "ai-lab":
      openInlineTutor(labTutor(labObservation(labState, get("lab-stage"))), el);
      break;
    case "drill-type":
      drillType = el.dataset.type;
      drillLevel = 0;
      drillChapter = 0;
      render();
      break;
    case "drill-types":
      drillType = "";
      render();
      break;
    case "drill-start":
      start(
        model.qs.filter(
          (q) =>
            q.type === drillType &&
            (!drillChapter || q.chapter === drillChapter) &&
            (!drillLevel || q.difficulty === drillLevel),
        ),
        drillType + "专项",
        +get("type-n").value,
        !drillLevel,
      );
      break;
    case "advice-start": {
      let pool = model.qs.filter(
        (q) => q.chapter === +ch && (!topic || q.topic === topic),
      );
      if (el.dataset.mode === "coverage") {
        const fresh = pool.filter((q) => !model.hist.has(q.id));
        if (fresh.length) pool = fresh;
      }
      start(pool, (topic || chapter(ch).short) + "针对练习", 5);
      break;
    }
    case "cause-round": {
      const ids = new Set(
        model.graded
          .filter((a) => !a.ok && a.reason === el.dataset.cause)
          .map((a) => a.qid),
      );
      start(
        model.qs.filter((q) => ids.has(q.id)),
        el.dataset.cause + "错因专项",
        8,
      );
      break;
    }
    case "reason": {
      await store.add("reason", {
        attempt: el.dataset.at,
        reason: el.dataset.cause,
      });
      rebuild();
      if (get("studio-dialog").open) {
        const e = store.events().find((e) => e.id === el.dataset.at);
        if (e) detail(e.data.qid);
      } else render();
      break;
    }
    case "tutor-back": {
      const back = tutorReturn;
      tutorReturn = null;
      tutorContext = generalTutor;
      navigate(back?.page || "home", false);
      if (back?.detail) detail(back.detail);
      break;
    }
    case "tutor-general":
      tutorContext = generalTutor;
      tutorReturn = null;
      render();
      break;
    case "nav":
      if (page === "tutor") {
        tutorReturn = null;
        tutorContext = generalTutor;
      }
      if (page === "lab") labReturn = null;
      navigate(page);
      break;
    case "menu":
      menu = !menu;
      host.querySelector(".shell")?.classList.toggle("menuopen", menu);
      host
        .querySelector(".menu-btn")
        ?.setAttribute("aria-expanded", String(menu));
      (menu
        ? host.querySelector(".sidebar .active")
        : host.querySelector(".menu-btn")
      )?.focus();
      break;
    case "close":
      close();
      break;
    case "new":
      editor();
      break;
    case "edit":
      editor(model.byId.get(id), true);
      break;
    case "import":
      importer();
      break;
    case "backup":
      backup();
      break;
    case "favorite":
      await store.add("favorite", { qid: id, on: !model.favs.has(id) });
      rebuild();
      render();
      toast(model.favs.has(id) ? "已加入收藏" : "已取消收藏");
      break;
    case "chapter":
      chapterDetail = +id;
      navigate("chapters", false);
      break;
    case "all-chapters":
      chapterDetail = 0;
      render();
      break;
    case "recommended": {
      const r = recommendation();
      if (r.kind === "resume") navigate("quiz");
      else navigate("plan");
      break;
    }
    case "adaptive":
      navigate("plan");
      break;
    case "topic-round":
      start(
        model.qs.filter((q) => q.topic === topic && q.chapter === +ch),
        topic + "专项",
      );
      break;
    case "start-chapter":
      setupCount = +get("setup-n").value;
      start(
        filteredChapter(),
        chapter(chapterDetail).name + "专项",
        setupCount,
      );
      break;
    case "start-filter":
      start(
        baseList().filter(matches),
        view === "mistakes" ? "回顾练习" : "题库筛选练习",
        8,
      );
      break;
    case "single":
      close();
      start([model.byId.get(id)], "单题练习", 1);
      break;
    case "account": {
      const email = store.identity().email;
      const d = modal(
        "我的账号",
        '<div class="account-summary"><h3>' +
          esc(email || "已登录") +
          "</h3><p>" +
          esc(syncLabel) +
          '</p><p>题库修改、收藏、错因、练习和模考进度都随账号保存。</p><div class="formactions"><button class="btn" id="account-refresh">重新读取进度</button><a class="btn" href="/?auth=change">修改密码</a><a class="btn" id="account-out" target="_top" href="/">退出账号</a></div></div>',
      );
      d.querySelector("#account-refresh").onclick = () => location.reload();
      d.querySelector("#account-out").onclick = async (e) => {
        e.preventDefault();
        const saved = await store.flush();
        if (saved || d.querySelector("#account-out").dataset.discard) {
          if (store.identity().local) {
            const r = await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "logout" }),
            });
            if (!r.ok) {
              toast("退出失败，请重试");
              return;
            }
          }
          window.open("/", "_top");
        } else {
          const b = d.querySelector("#account-out");
          b.dataset.discard = "1";
          b.textContent = "放弃未保存的草稿并退出";
          toast("草稿尚未保存。可重试或直接退出。");
        }
      };
      break;
    }
    case "goal": {
      const d = modal(
        "每日练习目标",
        '<form id="goal-form"><label class="formlabel">每天完成题数<input id="goal-count" required type="number" min="1" max="100" value="' +
          model.goal +
          '"></label><div class="formactions">' +
          button("取消", "close") +
          '<button class="btn primary" type="submit">保存目标</button></div></form>',
      );
      d.querySelector("#goal-form").onsubmit = async (e) => {
        e.preventDefault();
        await store.add("goal", { count: +get("goal-count").value });
        rebuild();
        close();
        render();
        toast("练习目标已更新");
      };
      break;
    }
    case "ref-next":
      refIdx = (refIdx + 1) % 3;
      render();
      break;
    case "detail":
      detail(id);
      break;
    case "mistab":
      mistab = id;
      filter = { chapter: 0, topic: "", type: "", query: "", page: 1 };
      render();
      break;
    case "guide-mode":
      guideMode = id;
      render();
      break;
    case "next-page":
    case "prev-page":
      filter.page += action === "next-page" ? 1 : -1;
      render();
      window.scrollTo({ top: 0, behavior: "instant" });
      break;
    case "choose": {
      const i = session.index,
        q = roundQuestion(i),
        sel = session.draft[i] || [],
        option = q.options[+index];
      if (lookupSessionAnswer(i)) return;
      session.draft[i] =
        q.type === "多选题"
          ? sel.includes(option)
            ? sel.filter((k) => k !== option)
            : [...sel, option]
          : [option];
      persist();
      render();
      break;
    }
    case "submit":
      await submit();
      break;
    case "grade":
      await submit(el.dataset.ok === "1");
      break;
    case "reveal":
      if (
        session.text[session.index]?.trim() ||
        session.sketches?.[session.index]?.length
      ) {
        session.revealed[session.index] = true;
        persist();
        render();
      }
      break;
    case "next":
      if (session.ids.every((_, i) => lookupSessionAnswer(i))) finish();
      else
        move(
          session.index < session.ids.length - 1
            ? session.index + 1
            : session.ids.findIndex((_, i) => !lookupSessionAnswer(i)),
        );
      break;
    case "previous":
      move(Math.max(0, session.index - 1));
      break;
    case "jump":
      move(+index);
      break;
    case "finish":
      finish();
      break;
    case "leave":
      persist();
      if (!(await store.flush())) {
        toast("进度尚未保存，请重试。");
        break;
      }
      navigate("home");
      break;
    case "resume":
      close();
      navigate("quiz");
      break;
  }
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menu && !get("studio-dialog")?.open)
    handle(host.querySelector(".menu-btn"));
});
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (el && !el.disabled) {
    if (el.dataset.action === "close") e.preventDefault();
    handle(el).catch((err) => toast("操作未完成：" + err.message));
  }
});
document.addEventListener("input", (e) => {
  const t = e.target;
  examInput(t);
  if (t.id === "query") {
    filter.query = t.value;
    filter.page = 1;
    get("records").innerHTML = recordList();
  }
  if (t.id === "guide-query") {
    guideQuery = t.value;
    if (!e.isComposing) {
      const pos = t.selectionStart;
      render();
      get("guide-query").focus();
      get("guide-query").setSelectionRange(pos, pos);
    }
  }
  if (t.id === "q-text") {
    session.text[session.index] = t.value;
    persist();
    const b = document.querySelector(
      '[data-action="reveal"],[data-action="submit"]',
    );
    if (b)
      b.disabled =
        !t.value.trim() && !session.sketches?.[session.index]?.length;
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  examInput(t);
  if (t.id === "plan-size") {
    planCount = Number(t.value);
    revisedPlan = null;
    render();
    get("plan-size")?.focus();
    return;
  }
  if (t.id === "type-ch") {
    drillChapter = +t.value;
    render();
  }
  if (t.id === "type-level") {
    drillLevel = +t.value;
    render();
  }
  if (["filter-ch", "filter-type", "filter-topic"].includes(t.id)) {
    if (t.id === "filter-ch") {
      filter.chapter = +t.value;
      filter.topic = "";
    } else if (t.id === "filter-type") filter.type = t.value;
    else filter.topic = t.value;
    filter.page = 1;
    render();
  }
  if (t.id === "guide-ch") {
    guideCh = +t.value;
    render();
  }
  if (t.id.startsWith("setup-")) {
    const n = filteredChapter().length;
    get("pool-info").textContent = n
      ? "符合条件 " +
        n +
        " 道，本轮将选取 " +
        Math.min(n, Number(get("setup-n").value)) +
        " 道。"
      : "当前组合没有题目，请调整条件。";
    document.querySelector('[data-action="start-chapter"]').disabled = !n;
  }
});
async function boot() {
  const read = async (path) => {
    const response = await fetch(path);
    if (response.status === 401) {
      location.reload();
      throw Error("请重新登录。");
    }
    if (!response.ok) throw Error("资料暂未载入，请重试。");
    return response.json();
  };
  const [{ course: data, history }, initial] = await Promise.all([
    read("/api/course/pack"),
    read("/api/start"),
  ]);
  if (initial.account.scope !== host.dataset.scope) {
    location.reload();
    return;
  }
  seed = data.questions.map(normalize);
  bankRevision = data.revision;
  if (data.revision >= 3) {
    retired = history.retired.map(normalize);
    legacy = {
      options: history.options,
      revised: Object.fromEntries(
        Object.entries(history.revised || {}).map(([id, q]) => [id, normalize(q)]),
      ),
      replacements: history.replacements || {},
      changed: Object.fromEntries(
        Object.entries(history.changed).map(([id, q]) => [id, normalize(q)]),
      ),
    };
  }
  refs = data.references;
  const dialog = document.createElement("dialog");
  dialog.id = "studio-dialog";
  document.body.appendChild(dialog);
  dialog.addEventListener("close", () => {
    dismissDialogTutor(dialog);
    disposeDialog?.();
    disposeDialog = null;
    tickOn();
  });
  dialog.onclick = (e) => {
    if (e.target === dialog) {
      const b = dialog.getBoundingClientRect();
      if (
        e.clientX < b.left ||
        e.clientX > b.right ||
        e.clientY < b.top ||
        e.clientY > b.bottom
      )
        close();
    }
  };
  const alert = document.createElement("div");
  alert.className = "toast";
  alert.id = "toast";
  alert.setAttribute("role", "status");
  document.body.appendChild(alert);
  await store.init(
    (s) => {
      syncLabel = s;
      if (get("sync-indicator")) get("sync-indicator").textContent = s;
    },
    () => {
      rebuild();
      if (
        !get("studio-dialog").open &&
        !["quiz", "lab", "tutor"].includes(view) &&
        !["INPUT", "SELECT", "TEXTAREA"].includes(
          document.activeElement?.tagName,
        )
      )
        render();
    },
    initial,
  );
  configure({
    saveQuestions: async (qs) => {
      for (const q of qs) await store.add("question", q);
      rebuild();
      render();
    },
    events: store.events,
    model: () => model,
    restore: async (r) => {
      await store.restore(r);
      rebuild();
      render();
    },
    toast,
  });
  rebuild();
  session = store.draft("round");
  upgradeRound();
  setupExam({
    revision: bankRevision,
    legacy: legacy.changed,
    model: () => model,
    page: () => view,
    render,
    events: store.events,
    add: store.add,
    toast,
    refresh: rebuild,
  });
  useHash();
  window.addEventListener("popstate", useHash);
  window.addEventListener("study-conflict", (e) => {
    const d = modal(
      "进度已在另一台设备更新",
      "<p>" +
        esc(e.detail) +
        '</p><div class="formactions"><button class="btn primary" id="refresh-cloud">打开最新进度</button></div>',
    );
    d.querySelector("#refresh-cloud").onclick = () => location.reload();
  });
}
boot().catch((e) => {
  host.innerHTML =
    '<main class="loading"><h1>题库暂未载入</h1><p>' +
    esc(e.message) +
    '</p><button class="btn" id="retry-load">重新载入</button></main>';
  get("retry-load").onclick = () => location.reload();
});
