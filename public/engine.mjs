import { chapters, types, safeImage, figureName, formOf, causes } from "./ui.mjs";
export const questionOrigins = ["原题", "改编题", "原创题"];
export function questionOrigin(value) {
  if (value === "试卷原题" || value === "原题校订") return "原题";
  if (value === "题库改编") return "改编题";
  return questionOrigins.includes(value) ? value : "原创题";
}
export function normalize(q) {
  const field = (k, n) =>
    String(q[k] ?? "")
      .trim()
      .slice(0, n);
  const chapter = Number(q.chapter),
    type = field("type", 10) || "单选题",
    stem = field("stem", 6000);
  if (!chapters.some((c) => c.id === chapter) || !types.includes(type) || !stem)
    throw Error("请补全题干、章节和题型。");
  const options = (Array.isArray(q.options) ? q.options : []).map((x) =>
    String(x).trim().slice(0, 1800),
  );
  const answers = [
    ...new Set(
      (Array.isArray(q.answers)
        ? q.answers
        : Number.isInteger(q.answer)
          ? [q.answer]
          : []
      ).map(Number),
    ),
  ].sort((a, b) => a - b);
  const isChoice =
      options.length > 0 || ["单选题", "多选题", "判断题"].includes(type),
    hasNumber = type === "计算题" && Number.isFinite(q.value);
  const accepted = (Array.isArray(q.accepted) ? q.accepted : [])
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 30);
  if (
    isChoice &&
    (options.length < 2 ||
      options.length > 8 ||
      options.some((x) => !x) ||
      new Set(options).size !== options.length ||
      !answers.length ||
      answers.some(
        (x) => !Number.isInteger(x) || x < 0 || x >= options.length,
      ) ||
      (type === "多选题" ? answers.length < 2 : answers.length !== 1) ||
      (type === "判断题" && options.length !== 2))
  )
    throw Error(
      "请检查选项和正确答案。多选题至少选两个正确项，判断题使用两个选项。",
    );
  if (
    !isChoice &&
    !hasNumber &&
    !accepted.length &&
    !field("explanation", 12000)
  )
    throw Error("请填写可核对的参考答案或评分点。");
  if (type === "填空题" && !accepted.length && !q.rubric?.length)
    throw Error("请填写标准答案或等价答案。");
  if (q.tolerance != null && (!Number.isFinite(q.tolerance) || q.tolerance < 0))
    throw Error("请填写非负的绝对误差。");
  if (q.image && !safeImage(q.image)) throw Error("题图格式或大小不符合要求。");
  return {
    id: field("id", 100),
    chapter,
    type,
    stem,
    topic: field("topic", 90) || chapters[chapter - 1].short,
    options,
    answers: isChoice ? answers : [],
    accepted,
    unordered: q.unordered === true,
    value: hasNumber ? q.value : null,
    tolerance: hasNumber ? (q.tolerance ?? 0) : null,
    unit: field("unit", 48),
    difficulty: [1, 2, 3].includes(+q.difficulty) ? +q.difficulty : 1,
    family: field("family", 120) || field("topic", 90),
    rubric: (Array.isArray(q.rubric) ? q.rubric : []).map(String).slice(0, 12),
    url: /^https:\/\//.test(q.url || "") ? field("url", 1500) : "",
    explanation: field("explanation", 12000),
    pitfall: field("pitfall", 3000),
    hint: field("hint", 500),
    origin: questionOrigin(q.origin),
    source: field("source", 200) || "个人录入",
    image: q.image || "",
    figures: (Array.isArray(q.figures) ? q.figures : [])
      .filter((f) => f && figureName(f.name) && ["stem", "solution"].includes(f.placement))
      .slice(0, 8)
      .map(({ name, label, placement }) => ({
        name, label: String(label || "题图").slice(0, 100), placement,
      })),
    draw: q.draw === true,
  };
}
const supNums = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export function canonical(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[−–]/g, "-")
    .replace(/π/g, "pi")
    .replace(/[，、]/g, ",")
    .replace(/[。.]$/, "")
    .toLowerCase();
}
export function numberValue(input) {
  if (input == null || !String(input).trim()) return null;
  let s = String(input)
    .trim()
    .replace(
      /[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,
      (m) =>
        "^" +
        [...m]
          .map((c) => (c === "⁺" ? "+" : c === "⁻" ? "-" : supNums.indexOf(c)))
          .join(""),
    )
    .normalize("NFKC")
    .replace(/[−–]/g, "-")
    .replace(/\s/g, "")
    .replace(/[×*·]10\^?([+-]?\d+)$/i, "e$1");
  if (/^[-+]?\d+(?:\.\d+)?\/[-+]?\d+(?:\.\d+)?$/.test(s)) {
    const [a, b] = s.split("/").map(Number);
    return b !== 0 ? a / b : null;
  }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function blankKey(q, value) {
  const text = canonical(value)
    .replace(/(?<=\w)[_^{}]/g, "")
    .replaceAll("ᵥ", "v");
  return q.unordered ? text.split(",").sort().join(",") : text;
}
export function correct(q, a) {
  if (!q || !a) return null;
  if (a.missed) return false;
  const mode = formOf(q);
  if (mode === "written") return typeof a.grade === "boolean" ? a.grade : null;
  if (mode === "number") {
    const n = numberValue(a.text);
    return n === null
      ? null
      : Math.abs(n - q.value) <=
          q.tolerance +
            Number.EPSILON *
              Math.max(Number.MIN_VALUE, Math.abs(q.value), Math.abs(n)) *
              4;
  }
  if (mode === "blank")
    return typeof a.text === "string"
      ? q.accepted.some((k) => blankKey(q, k) === blankKey(q, a.text))
      : null;
  if (!Array.isArray(a.choice) || a.choice.some((x) => !q.options.includes(x)))
    return null;
  return (
    a.choice.length === q.answers.length &&
    q.answers.every((i) => a.choice.includes(q.options[i]))
  );
}
export function materialize(seed, events, retired = [], previous = {}, revised = {}, replacements = {}) {
  const active = new Set(seed.map((q) => q.id));
  const edited = new Set();
  const qs = new Map([...retired, ...seed].map((q) => [q.id, q])),
    favoriteEvents = [],
    favs = new Set(),
    allAttempts = [],
    reasons = new Map(),
    hist = new Map(),
    topics = new Map();
  let goal = 10;
  const ordered = [...events].sort(
    (a, b) => a.at - b.at || a.id.localeCompare(b.id),
  );
  for (const e of ordered) {
    const d = e.data;
    if (e.kind === "question") {
      try {
        const q = normalize(d);
        if (q.id) {
          qs.set(q.id, q);
          active.add(q.id);
          edited.add(q.id);
        }
      } catch {}
    }
    if (e.kind === "favorite") favoriteEvents.push(d);
    if (e.kind === "reason" && causes.includes(d.reason))
      reasons.set(d.attempt, d.reason);
    if (e.kind === "attempt") allAttempts.push({ ...d, at: e.at, id: e.id });
    if (
      e.kind === "goal" &&
      Number.isInteger(d.count) &&
      d.count >= 1 &&
      d.count <= 100
    )
      goal = d.count;
  }
  const currentId = (id) =>
    !edited.has(id) && Object.hasOwn(replacements, id) ? replacements[id] : id;
  for (const { qid, on } of favoriteEvents) {
    const id = currentId(qid);
    if (on) favs.add(id);
    else favs.delete(id);
  }
  const graded = [],
    skipped = [];
  for (const a of allAttempts) {
    if (a.missed) {
      skipped.push(a);
      continue;
    }
    const q = qs.get(a.qid);
    const priorBank = a.bankRevision === 3 ? revised : !a.bankRevision ? previous : {};
    const prior =
      !edited.has(a.qid) && Object.hasOwn(priorBank, a.qid)
        ? priorBank[a.qid]
        : null;
    const historical = Boolean(a.bankRevision === 3 && prior) || !!(
      q &&
      prior &&
      (prior.stem !== q.stem ||
        formOf(prior) !== formOf(q) ||
        prior.options.some((x) => !q.options.includes(x)))
    );
    const ok = correct(historical ? prior : q, a);
    if (ok === null) continue;
    const entry = { ...a, ok, historical, reason: reasons.get(a.id) || "" };
    graded.push(entry);
    const target = qs.get(currentId(q.id)) || q;
    if (!hist.has(q.id)) hist.set(q.id, []);
    hist.get(q.id).push(entry);
    if (target.id !== q.id) {
      if (!hist.has(target.id)) hist.set(target.id, []);
      hist.get(target.id).push({ ...entry, historical: true });
    }
    const key = target.chapter + "|" + target.topic,
      t = topics.get(key) || { chapter: target.chapter, topic: target.topic, n: 0, k: 0 };
    t.n++;
    if (ok) t.k++;
    topics.set(key, t);
  }
  return {
    qs: [...qs.values()].filter((q) => active.has(q.id)),
    byId: qs,
    edited,
    favs,
    hist,
    topics,
    graded,
    goal,
    reasons,
    skipped,
  };
}
export const pct = (k, n) => (n ? Math.round((100 * k) / n) : null);
export const stats = (attempts) => ({
  n: attempts.length,
  k: attempts.filter((a) => a.ok).length,
  rate: pct(attempts.filter((a) => a.ok).length, attempts.length),
});
export function plan(pool, model, n = 8, now = Date.now(), rand = Math.random) {
  const ranked = pool
    .map((q) => {
      const h = model.hist.get(q.id) || [],
        last = h.at(-1),
        t = model.topics.get(q.chapter + "|" + q.topic),
        rate = t ? (t.k + 1) / (t.n + 2) : 0.5;
      const targetLevel =
        t && t.n >= 5 && rate >= 0.8 ? 3 : t && t.n > 0 && rate >= 0.45 ? 2 : 1;
      const levelMatch = 1 - Math.abs(targetLevel - q.difficulty) * 0.45;
      const due = last ? Math.min(1, (now - last.at) / 86400000 / 3) : 0;
      let weight =
        (1 - rate) * 2.6 +
        (last && !last.ok ? 2.3 : 0) +
        (!last ? 1.25 : 0) +
        due * 1.2 +
        levelMatch +
        rand() * 0.7;
      if (last?.ok && now - last.at < 86400000) weight -= 1.4;
      return { q, weight };
    })
    .sort((a, b) => b.weight - a.weight);
  const picks = [],
    usage = new Map();
  while (picks.length < n && ranked.length) {
    let best = 0,
      highest = -Infinity;
    ranked.forEach(({ q, weight }, i) => {
      const score = weight - (usage.get(q.family || q.topic) || 0) * 1.2;
      if (score > highest) {
        best = i;
        highest = score;
      }
    });
    const { q } = ranked.splice(best, 1)[0];
    picks.push(q.id);
    usage.set(q.family || q.topic, (usage.get(q.family || q.topic) || 0) + 1);
  }
  return picks;
}
export function inferChapter(s) {
  const x = String(s);
  if (/晶胞|晶格|晶面|堆积|立方|密堆积/.test(x)) return 7;
  if (/配体场|晶体场|高自旋|低自旋|配位数|配合物/.test(x)) return 8;
  if (/点群|对称|群阶|镜面|手性|C[₂₃₄₆]|C[2346][vhd]/.test(x)) return 4;
  if (/谱项|谱支项|洪特|微观状态|LS\s*耦合|多重度/.test(x)) return 6;
  if (/离域|共轭|休克尔|HMO|Hückel|丁二烯|烯丙基/.test(x)) return 5;
  if (/键级|反键|双原子|磁性|分子轨道/.test(x)) return 3;
  if (/原子轨道|节点|氢原子|量子数|氦原子|电子组态|径向|原子结构/.test(x))
    return 2;
  return 1;
}
export function inferTopic(s, ch) {
  const groups = [
    [/晶胞|晶格|立方/, "晶胞计算"],
    [/晶面/, "晶面指数"],
    [/晶体场|配体场/, "晶体场分裂"],
    [/高自旋|低自旋/, "配合物磁性"],
    [/光电|遏止/, "光电效应"],
    [/德布罗意|物质波/, "德布罗意波长"],
    [/势阱|势箱|箱中/, "一维势箱能级"],
    [/光子/, "光子能量"],
    [/节点|结点/, "轨道节点"],
    [/径向/, "径向分布"],
    [/氦|He.*1s/, "氦原子波函数"],
    [/归一|正交/, "正交归一"],
    [/量子数/, "量子数"],
    [/群阶/, "群阶"],
    [/点群|对称群/, "点群判断"],
    [/镜面|反演|对称轴/, "对称操作"],
    [/红外|振动/, "振动光谱"],
    [/谱项|项符号/, "光谱项"],
    [/微观状态/, "微观状态计数"],
    [/洪特/, "洪特规则"],
    [/离域/, "离域能"],
    [/Hückel|HMO|休克尔/, "休克尔近似"],
    [/成键|键级/, "分子轨道键级"],
    [/磁性|顺磁|抗磁/, "分子磁性"],
  ];
  return (
    groups.find(([r]) => r.test(s))?.[1] ||
    chapters.find((c) => c.id === ch)?.short ||
    "综合"
  );
}
export function readTextQuestions(text) {
  return text
    .trim()
    .split(/\n\s*---+\s*\n|\n(?=(?:第\s*\d+\s*题|\d+[\.、．]\s*)[^\n])/)
    .filter(Boolean)
    .map((block, i) => {
      const lines = block
          .trim()
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        opts = [],
        stem = [],
        meta = {};
      let field = "stem";
      for (let l of lines) {
        const m = l.match(
            /^(章节|知识点|题型|答案|解析|易错点|来源|单位|容差|难度|评分点)\s*[：:]\s*(.*)$/,
          ),
          o = l.match(/^([A-H])[\.、．:：)）]\s*(.*)$/i);
        if (m) {
          field = m[1];
          meta[field] = m[2];
        } else if (o) {
          field = "option";
          opts.push(o[2]);
        } else if (field === "option") opts[opts.length - 1] += " " + l;
        else if (field === "stem") stem.push(l);
        else meta[field] += " " + l;
      }
      const sentence = stem
        .join(" ")
        .replace(/^(第\s*\d+\s*题[.、：:]?|\d+[.、．])\s*/, "");
      const c = chapters.find(
        (ch) =>
          meta["章节"] &&
          (meta["章节"] === String(ch.id) ||
            meta["章节"].includes(ch.name) ||
            meta["章节"].includes(ch.short)),
      );
      const ans = (meta["答案"] || "").toUpperCase().replace(/[\s,，、]+/g, "");
      const judgment = opts.length === 0 && /^(正确|错误|对|错|√|×)$/.test(ans);
      const objective = Boolean(opts.length || judgment),
        letters = objective
          ? judgment
            ? [["正确", "对", "√"].includes(ans) ? 0 : 1]
            : [...ans].map((x) => x.charCodeAt(0) - 65)
          : [];
      const type =
        meta["题型"] ||
        (judgment
          ? "判断题"
          : objective
            ? letters.length > 1
              ? "多选题"
              : "单选题"
            : "简答题");
      try {
        return normalize({
          chapter: c?.id || inferChapter(sentence),
          stem: sentence,
          type,
          options: judgment ? ["正确", "错误"] : opts,
          answers: letters,
          difficulty:
            { 基础: 1, 进阶: 2, 综合: 3 }[meta["难度"]] ||
            Number(meta["难度"]) ||
            1,
          accepted: type === "填空题" ? (meta["答案"] || "").split("|") : [],
          value:
            type === "计算题" && !objective ? numberValue(meta["答案"]) : null,
          tolerance: meta["容差"] != null ? Number(meta["容差"]) : null,
          unit: meta["单位"] || "",
          rubric: (meta["评分点"] || "").split(/[；;]/).filter(Boolean),
          topic:
            meta["知识点"] ||
            inferTopic(sentence, c?.id || inferChapter(sentence)),
          explanation: [!objective ? meta["答案"] : "", meta["解析"]]
            .filter(Boolean)
            .join("\n"),
          pitfall: meta["易错点"],
          source: meta["来源"] || "文本导入",
        });
      } catch (e) {
        throw Error("第 " + (i + 1) + " 题：" + e.message);
      }
    });
}
