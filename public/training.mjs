import {
  esc,
  icon,
  chapters,
  chapter,
  types,
  difficulty,
  tag,
  causes,
} from "./ui.mjs";
import { stats } from "./engine.mjs";
const meta = {
  单选题: ["list", "teal", "辨认唯一成立的结论，区分相近概念。"],
  多选题: ["stack", "lavender", "逐项判断，检查漏选与多选。"],
  判断题: ["check", "blue", "检验结论所依赖的前提。"],
  填空题: ["pen", "amber", "回忆项符号、点群和关键关系。"],
  计算题: ["formula", "violet", "列式、代入数值并核对单位。"],
  简答题: ["note", "teal", "写出结论及其物理或化学依据。"],
  推导题: ["wave", "rose", "从假设出发，写清每一步推理。"],
  作图题: ["atom", "blue", "画出能级、轨道或几何关系，标明关键特征。"],
};
const card = (title, body) =>
  '<section class="box reportcard"><h2>' +
  title +
  "</h2>" +
  body +
  "</section>";
const pill = (x, i) =>
  '<span class="tag ' +
  (i === 3 ? "amber" : i === 2 ? "lav" : "good") +
  '">' +
  esc(x) +
  "</span>";
export function typePage(m, selected = "", level = 0, ch = 0) {
  let s =
    '<header class="pagehead"><div><h1>题型突破</h1><p>按考法专项练习，从基础辨析逐步进入计算、推导与作图。</p></div></header>';
  if (!selected)
    return (
      s +
      '<div class="typegrid">' +
      types
        .map((t) => {
          const pool = m.qs.filter((q) => q.type === t),
            done = pool.filter((q) => m.hist.has(q.id)).length,
            [ic, col, desc] = meta[t];
          return (
            '<button class="chaptercard typecard" data-action="drill-type" data-type="' +
            t +
            '"><div class="top"><span class="iconblock ' +
            col +
            '">' +
            icon(ic) +
            "</span><div><h3>" +
            t +
            '</h3><span class="muted">' +
            pool.length +
            " 道题</span></div></div><p>" +
            desc +
            '</p><div class="cardmeta"><span>已练 ' +
            done +
            " / " +
            pool.length +
            '</span><span>专项训练</span></div><div class="bar"><i style="width:' +
            (pool.length ? (done / pool.length) * 100 : 0) +
            '%"></i></div></button>'
          );
        })
        .join("") +
      "</div>"
    );
  const all = m.qs.filter(
      (q) => q.type === selected && (!ch || q.chapter === ch),
    ),
    p = all.filter((q) => !level || q.difficulty === level);
  return (
    s +
    '<div class="box"><div class="sectionhead"><h2>' +
    selected +
    '专项</h2><button class="plain" data-action="drill-types">全部题型</button></div><p class="muted">' +
    meta[selected][2] +
    '</p><div class="filters" style="margin:15px 0"><select id="type-ch" aria-label="专项章节"><option value="0">全部章节</option>' +
    chapters
      .map(
        (c) =>
          '<option value="' +
          c.id +
          '" ' +
          (ch === c.id ? "selected" : "") +
          ">" +
          c.name +
          "</option>",
      )
      .join("") +
    '</select><select id="type-level" aria-label="专项难度"><option value="0">梯度练习</option>' +
    difficulty
      .slice(1)
      .map(
        (d, i) =>
          '<option value="' +
          (i + 1) +
          '" ' +
          (level === i + 1 ? "selected" : "") +
          ">" +
          d +
          "</option>",
      )
      .join("") +
    '</select><select id="type-n" aria-label="专项题数"><option value="5">5 题</option><option value="8" selected>8 题</option><option value="15">15 题</option></select><button class="btn primary" data-action="drill-start" ' +
    (p.length ? "" : "disabled") +
    ">" +
    icon("play", 15) +
    '开始专项练习</button></div><p class="muted">匹配 ' +
    p.length +
    ' 道题。梯度练习按基础、进阶、综合排列。</p></div><div class="levelgrid">' +
    [1, 2, 3]
      .map((l) => {
        const qs = all.filter((q) => q.difficulty === l);
        return card(
          pill(difficulty[l], l),
          '<div class="levelnum">' +
            qs.length +
            ' <small>题</small></div><p class="muted">已练 ' +
            qs.filter((q) => m.hist.has(q.id)).length +
            " 道</p>",
        );
      })
      .join("") +
    "</div>"
  );
}
function summary(m, p) {
  const ids = new Set(p.map((q) => q.id)),
    attempts = m.graded.filter((a) => ids.has(a.qid)),
    all = stats(attempts),
    seen = p.filter((q) => m.hist.has(q.id)).length,
    speeds = attempts
      .map((a) => a.seconds)
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
  return {
    ...all,
    seen,
    total: p.length,
    median:
      speeds.length >= 3
        ? Math.round(speeds[Math.floor(speeds.length / 2)])
        : null,
  };
}
function recommendRows(m) {
  const rs = [];
  for (const c of chapters) {
    const pool = m.qs.filter((q) => q.chapter === c.id),
      a = summary(m, pool);
    if (!a.total) continue;
    if (a.seen === 0)
      rs.push({
        priority: 2,
        kind: "覆盖不足",
        title: c.name,
        detail:
          "本专题共 " +
          a.total +
          " 道题，尚无作答记录。先练 5 道基础题建立起点。",
        ch: c.id,
        mode: "coverage",
      });
    else if (a.seen < Math.min(4, a.total))
      rs.push({
        priority: 3,
        kind: "样本较少",
        title: c.name,
        detail:
          "只练过 " +
          a.seen +
          " 道不同题目。补做未练题后，再判断这个专题的掌握度。",
        ch: c.id,
        mode: "coverage",
      });
    if (a.n >= 3 && a.rate < 70)
      rs.push({
        priority: 8 + (70 - a.rate) / 100,
        kind: "正确率偏低",
        title: c.name,
        detail:
          a.n +
          " 次作答中答对 " +
          a.k +
          " 次（" +
          a.rate +
          "%）。优先重做最近答错的题，再练相邻知识点。",
        ch: c.id,
        mode: "weak",
      });
  }
  const repeat = m.qs
    .map((q) => ({ q, h: m.hist.get(q.id) || [] }))
    .filter(({ h }) => h.filter((a) => !a.ok).length >= 2 && !h.at(-1)?.ok)
    .sort((a, b) => b.h.length - a.h.length)[0];
  if (repeat)
    rs.push({
      priority: 12,
      kind: "重复失分",
      title: repeat.q.topic,
      detail:
        "这道题已答错 " +
        repeat.h.filter((a) => !a.ok).length +
        " 次。先核对解析的第一步，再在同知识点题目上复现做法。",
      topic: repeat.q.topic,
      ch: repeat.q.chapter,
      mode: "repeat",
    });
  for (const c of chapters) {
    const troublesome = [...m.topics.values()]
      .filter((t) => t.chapter === c.id && t.n >= 1 && t.k < t.n)
      .sort((a, b) => a.k / a.n - b.k / b.n)[0];
    if (troublesome)
      rs.push({
        priority: troublesome.n >= 2 ? 7 : 4,
        kind: troublesome.n >= 2 ? "知识点薄弱" : "首次错答",
        title: troublesome.topic,
        detail:
          "已答 " +
          troublesome.n +
          " 次，正确 " +
          troublesome.k +
          " 次。" +
          (troublesome.n === 1
            ? "先用一道同类题检验这次失误。"
            : "结合原题解析重做，再用同类变式检查。"),
        ch: c.id,
        topic: troublesome.topic,
        mode: "topic",
      });
  }
  const missed =
    m.skipped?.filter(
      (a) => !(m.hist.get(a.qid) || []).some((v) => v.at > a.at),
    ) || [];
  if (missed.length) {
    const q = m.byId.get(missed.at(-1).qid);
    if (q)
      rs.push({
        priority: 7.6,
        kind: "模拟卷漏答",
        title: q.topic,
        detail: "模拟中留下了未答题。先单独解这一知识点，再安排限时重做。",
        topic: q.topic,
        ch: q.chapter,
        mode: "topic",
      });
  }
  const timed = m.graded.filter((a) => a.seconds >= 3);
  for (const t of types) {
    const same = timed.filter((a) => m.byId.get(a.qid)?.type === t);
    if (same.length < 6) continue;
    const sorted = same.map((a) => a.seconds).sort((a, b) => a - b),
      median = sorted[Math.floor(sorted.length / 2)];
    const recent = same.slice(-6),
      slow = recent.filter(
        (a) => a.ok && a.seconds >= Math.max(45, 2 * median),
      ),
      fast = recent.filter((a) => !a.ok && a.seconds < median * 0.5);
    if (slow.length >= 2 || fast.length >= 2) {
      const isFast = fast.length >= 2,
        a = (isFast ? fast : slow).at(-1),
        q = m.byId.get(a.qid);
      rs.push({
        priority: 6,
        kind: isFast ? "较快错答" : "正确但用时较长",
        title: t,
        detail:
          "该题型个人用时中位数为 " +
          median +
          " 秒。最近六次中有 " +
          (isFast
            ? fast.length +
              " 次错答用时不到中位数的一半，下一次先复核题干条件。"
            : slow.length +
              " 次答对但耗时至少为中位数的两倍，可用同类题练熟步骤。"),
        ch: q.chapter,
        topic: q.topic,
        mode: "topic",
      });
    }
  }
  return rs.sort((a, b) => b.priority - a.priority);
}
export const advice = {
  概念混淆: "先并排列出两个概念的定义和反例，再做同知识点辨析题。",
  公式或条件用错: "代入前写明模型与适用条件，再检查题干是否满足。",
  推导缺步: "先列假设和起点，逐行写出使用的关系式并核对边界条件。",
  读图与构型: "先标坐标轴、核位置与对称元素，再据图判断。",
  符号或单位: "先统一单位，单独检查上下标、能量正负号和量纲。",
  计算失误: "把常数、单位、代入式和数量级估算分行写出。",
  审题遗漏: "圈出所求量、参照态与限定词，再选择解法。",
  没找到思路: "对照解析写出第一步，合上解析后独立完成一道基础题。",
};
export function reportPage(m) {
  const allRec = recommendRows(m),
    unused = allRec.find((r) => r.mode === "coverage"),
    rec = allRec.slice(0, 3);
  if (unused && !rec.includes(unused)) rec[2] = unused;
  const errors = m.graded.filter((a) => !a.ok),
    tally = causes
      .map((c) => [c, errors.filter((a) => a.reason === c).length])
      .filter(([, n]) => n)
      .sort((a, b) => b[1] - a[1]),
    courses = chapters.map((c) => [
      c,
      summary(
        m,
        m.qs.filter((q) => q.chapter === c.id),
      ),
    ]);
  const row = (c, s) =>
    "<tr><td>" +
    esc(c) +
    "</td><td>" +
    s.seen +
    " / " +
    s.total +
    "</td><td>" +
    s.n +
    "</td><td>" +
    (s.rate === null ? "—" : s.rate + "%") +
    "</td><td>" +
    (s.median === null ? "—" : s.median + " 秒") +
    "</td></tr>";
  return (
    '<header class="pagehead"><div><h1>学情分析</h1><p>结合练习覆盖、正确率、作答用时和错因安排下一轮训练。</p></div><button class="btn" data-action="plan">' +
    icon("spark", 16) +
    "查看下一轮题单</button></header>" +
    card(
      "下一步练什么",
      '<div class="advicelist">' +
        rec
          .slice(0, 3)
          .map(
            (r) =>
              '<div class="adviceitem"><div>' +
              tag(r.kind, r.priority > 5 ? "amber" : "good") +
              " <b>" +
              esc(r.title) +
              "</b><p>" +
              esc(r.detail) +
              '</p></div><button class="btn small" data-action="advice-start" data-ch="' +
              r.ch +
              '" data-mode="' +
              r.mode +
              '" data-topic="' +
              esc(r.topic || "") +
              '">针对练习</button></div>',
          )
          .join("") +
        (rec.length
          ? ""
          : '<p class="muted">当前覆盖与正确率较均衡，可以继续做跨章节综合练习。</p>') +
        "</div>",
    ) +
    card(
      "章节掌握情况",
      '<div class="scrolltable"><table><thead><tr><th>章节</th><th>已练 / 总题数</th><th>作答次数</th><th>正确率</th><th>用时中位数</th></tr></thead><tbody>' +
        courses.map(([c, s]) => row(c.name, s)).join("") +
        '</tbody></table></div><p class="formhint">少于 3 次有效用时暂不计算中位数，重复作答会计入正确率。</p>',
    ) +
    (allRec.some((r) => r.priority === 6)
      ? card(
          "作答速度",
          allRec
            .filter((r) => r.priority === 6)
            .map(
              (r) =>
                '<div class="adviceitem"><div>' +
                tag(r.kind, "lav") +
                " <b>" +
                esc(r.title) +
                "</b><p>" +
                esc(r.detail) +
                "</p></div></div>",
            )
            .join(""),
        )
      : "") +
    card(
      "按题型定位",
      '<div class="scrolltable"><table><thead><tr><th>题型</th><th>已练 / 总题数</th><th>作答次数</th><th>正确率</th><th>用时中位数</th></tr></thead><tbody>' +
        types
          .map((t) =>
            row(
              t,
              summary(
                m,
                m.qs.filter((q) => q.type === t),
              ),
            ),
          )
          .join("") +
        "</tbody></table></div>",
    ) +
    card(
      "错因与改进方法",
      tally.length
        ? tally
            .map(
              ([c, n]) =>
                '<div class="adviceitem"><div><b>' +
                esc(c) +
                "</b> " +
                tag(n + " 次", "amber") +
                "<p>" +
                esc(advice[c]) +
                '</p></div><button class="btn small" data-action="cause-round" data-cause="' +
                esc(c) +
                '">重练此类错题</button></div>',
            )
            .join("")
        : '<p class="muted">答错后可标注错因。累计记录后，这里会显示高频失误与相应练法。</p>',
    ) +
    (errors.length && !tally.length
      ? '<p class="formhint">已有 ' +
        errors.length +
        " 次错答，可从错题详情补充错因。</p>"
      : "")
  );
}
