const titles = {
  baseline: "跨章摸底",
  review: "错题回练",
  probe: "知识点补测",
  coverage: "章节补练",
  pace: "同题型用时练习",
  maintenance: "间隔复习",
};

const count = (map, key) => map.get(key) || 0;
const increment = (map, key) => map.set(key, count(map, key) + 1);
const textKey = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byTime = (a, b) => a.at - b.at || byId(a, b);

function questionSignature(q) {
  if (!q.stem) return JSON.stringify([q.id]);
  const options = (q.options || []).map(textKey).sort();
  return JSON.stringify([
    textKey(q.stem),
    options,
    q.image || "",
    q.unit || "",
  ]);
}

function addEvidence(map, key, row) {
  const e = map.get(key) || {
    total: 0,
    seen: 0,
    attempts: 0,
    correct: 0,
    unresolved: 0,
  };
  e.total++;
  if (row.last) e.seen++;
  if (row.last?.ok === false) e.unresolved++;
  e.attempts += row.history.length;
  e.correct += row.history.length - row.errors;
  map.set(key, e);
}

function indexBank(model) {
  const chapters = new Map(),
    topics = new Map(),
    families = new Map(),
    timed = new Map();
  const unique = new Map(model.qs.filter((q) => q?.id).map((q) => [q.id, q]));
  let attempts = 0,
    latest = 0;
  // Copies with reordered choices still represent the same exercise. Keep the ID
  // the learner used most recently so a completed copy cannot reappear as unseen.
  const copies = new Map();
  for (const q of [...unique.values()].sort(byId)) {
    const signature = questionSignature(q);
    const copy = copies.get(signature) || {
      q,
      signature,
      history: [],
      latest: null,
    };
    for (const a of model.hist.get(q.id) || []) {
      if (a.historical || a.missed || typeof a.ok !== "boolean") continue;
      copy.history.push(a);
      if (!copy.latest || byTime(a, copy.latest) > 0) {
        copy.q = q;
        copy.latest = a;
      }
    }
    copies.set(signature, copy);
  }
  const rows = [...copies.values()].map(
    ({ q, signature, history: allHistory }) => {
      const eventIds = new Set();
      const history = allHistory.sort(byTime).filter((a) => {
        if (a.id && eventIds.has(a.id)) return false;
        if (a.id) eventIds.add(a.id);
        return true;
      });
      const familyName = q.family || q.topic || q.id;
      const topic = `${q.chapter}|${q.topic || q.id}`,
        family = `${q.chapter}|${familyName}`;
      const choice = !!q.options?.length;
      const objective =
        choice ||
        (q.type === "填空题" && !!q.accepted?.length) ||
        (q.type === "计算题" && Number.isFinite(q.value));
      const row = {
        q,
        topic,
        family,
        familyName,
        history,
        last: history.at(-1),
        errors: history.filter((a) => !a.ok).length,
        recentErrors: history.slice(-5).filter((a) => !a.ok).length,
        level: q.difficulty || 1,
        choice,
        objective,
        signature,
      };
      addEvidence(chapters, q.chapter, row);
      addEvidence(topics, topic, row);
      addEvidence(families, family, row);
      attempts += history.length;
      latest = Math.max(latest, row.last?.at || 0);
      for (const a of history) {
        if (!Number.isFinite(a.seconds) || a.seconds < 3) continue;
        if (!timed.has(q.type)) timed.set(q.type, []);
        timed
          .get(q.type)
          .push({
            at: a.at,
            id: a.id,
            seconds: a.seconds,
            ok: a.ok,
            qid: q.id,
            topic,
            family,
          });
      }
      return row;
    },
  );
  for (const row of rows) {
    if (row.last) continue;
    for (const [sample, name] of [
      [topics.get(row.topic), row.q.topic],
      [families.get(row.family), row.familyName],
    ]) {
      if (sample.seen >= 1 && sample.seen <= 2) {
        row.probe = { ...sample, name };
        break;
      }
    }
  }
  return { rows, chapters, timed, attempts, latest };
}

function slowPractice(timed) {
  const findings = [];
  for (const [type, records] of timed) {
    if (records.length < 6 || new Set(records.map((a) => a.qid)).size < 3)
      continue;
    const times = records.map((a) => a.seconds).sort((a, b) => a - b);
    const middle = Math.floor(times.length / 2);
    const median =
      times.length % 2
        ? times[middle]
        : (times[middle - 1] + times[middle]) / 2;
    const recent = [...records].sort(byTime).slice(-6);
    const slow = recent.filter(
      (a) => a.ok && a.seconds >= Math.max(45, 2 * median),
    );
    if (new Set(slow.map((a) => a.qid)).size < 2) continue;
    findings.push({
      type,
      median,
      n: records.length,
      slow: slow.length,
      at: slow.at(-1).at,
      topics: new Set(slow.map((a) => a.topic)),
      families: new Set(slow.map((a) => a.family)),
    });
  }
  return findings.sort(
    (a, b) => b.slow - a.slow || b.at - a.at || b.n - a.n,
  )[0];
}

function before(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

function describe(key, picks, chapters, pace) {
  if (key === "baseline") {
    const basics = picks.filter((r) => r.level === 1 && r.objective).length;
    if (basics === picks.length)
      return "从各章的基础客观题起步，先看看哪些概念已经熟悉。";
    if (basics)
      return `先选了 ${basics} 道基础客观题，再用题库里的其他题目补足。`;
    return "当前题库中的题目按章节和难度排入，用来建立第一批作答记录。";
  }
  if (key === "review") {
    const repeat = picks.filter((r) => r.errors >= 2).length;
    const cause = picks.find((r) => r.last.reason)?.last.reason;
    let reason = `这 ${picks.length} 道题上次作答时都答错了。`;
    if (repeat) reason += `其中 ${repeat} 道已经错过至少两次。`;
    else if (cause) reason += `你曾标记「${cause}」。`;
    return reason;
  }
  if (key === "probe") {
    const sample = picks[0].probe;
    return `「${sample.name}」此前只做过 ${sample.seen} 道不同的题。本组用尚未练过的相关题再测一次。`;
  }
  if (key === "coverage") {
    const usedChapters = [...new Set(picks.map((r) => r.q.chapter))];
    const examples = usedChapters.slice(0, 2).map((ch) => {
      const e = chapters.get(ch);
      return `第 ${ch} 章已练 ${e.seen}/${e.total} 道`;
    });
    return `${examples.join("，")}。本组选取尚未练过的题。`;
  }
  if (key === "pace") {
    return `${pace.type}共有 ${pace.n} 次有效计时，中位数为 ${pace.median} 秒。最近六次中有 ${pace.slow} 次答对且用时至少为中位数的两倍。`;
  }
  return "这些题上次都已答对，本组优先复习较早做过的题。";
}

export function buildRoundPlan(m, n = 10) {
  const { rows, chapters, timed, attempts, latest } = indexBank(m);
  const available = rows.length;
  const requested = Number.isFinite(Number(n))
    ? Math.max(0, Math.floor(Number(n)))
    : 10;
  const target = Math.min(requested, available);
  if (!target)
    return {
      title: "下一轮练习",
      intro: available
        ? "本轮选择了 0 道题。"
        : "当前题库没有可排入练习的题目。",
      groups: [],
      ids: [],
    };

  const picked = new Set(),
    grouped = new Map();
  const familyUse = new Map(),
    chapterUse = new Map(),
    newInChapter = new Map(),
    typeUse = new Map();
  function take(key, pool, limit, familyCap, rank) {
    const list = grouped.get(key) || [];
    for (let i = 0; i < limit && picked.size < target; i++) {
      let best, bestRank;
      for (const row of pool) {
        if (
          picked.has(row.signature) ||
          count(familyUse, row.family) >= familyCap
        )
          continue;
        const priority = rank(row);
        if (!best || before(priority, bestRank)) {
          best = row;
          bestRank = priority;
        }
      }
      if (!best) break;
      picked.add(best.signature);
      list.push(best);
      increment(familyUse, best.family);
      increment(chapterUse, best.q.chapter);
      increment(typeUse, best.q.type);
      if (!best.last) increment(newInChapter, best.q.chapter);
    }
    if (list.length) grouped.set(key, list);
  }

  let pace;
  if (!attempts) {
    const all = [...chapters.keys()].sort((a, b) => a - b);
    const breadth = Math.min(target, all.length);
    const spread = Array.from(
      { length: breadth },
      (_, i) =>
        all[
          breadth === 1 ? 0 : Math.round((i * (all.length - 1)) / (breadth - 1))
        ],
    );
    const order = new Map(
      [...spread, ...all.filter((ch) => !spread.includes(ch))].map((ch, i) => [
        ch,
        i,
      ]),
    );
    const baselineRank = (row) => [
      count(chapterUse, row.q.chapter),
      row.level === 1 && row.choice
        ? 0
        : row.objective
          ? row.level
          : 4 + row.level,
      count(familyUse, row.family),
      order.get(row.q.chapter),
      count(typeUse, row.q.type),
    ];
    take("baseline", rows, target, 2, baselineRank);
    take("baseline", rows, target, Infinity, baselineRank);
  } else {
    const review = rows.filter((r) => r.last?.ok === false);
    const probe = rows.filter((r) => r.probe);
    const unseen = rows.filter((r) => !r.last);
    const mastered = rows.filter((r) => r.last?.ok);
    const recent = latest - 14 * 86400000;
    const reviewRank = (r) => [
      count(familyUse, r.family),
      r.last.at >= recent ? 0 : 1,
      r.recentErrors >= 2 ? 0 : 1,
      -r.last.at,
      -r.errors,
    ];
    const probeRank = (r) => [
      r.probe.unresolved ? 0 : 1,
      count(familyUse, r.family),
      r.probe.seen,
      Math.abs(r.level - (r.probe.unresolved ? 1 : 2)),
      r.objective ? 0 : 1,
      count(chapterUse, r.q.chapter),
    ];
    const coverageRank = (r) => {
      const ch = chapters.get(r.q.chapter);
      const level = ch.seen >= 3 && ch.correct / ch.attempts >= 0.8 ? 2 : 1;
      return [
        (ch.seen + count(newInChapter, r.q.chapter)) / ch.total,
        count(chapterUse, r.q.chapter),
        count(familyUse, r.family),
        Math.abs(r.level - level),
        r.objective ? 0 : 1,
        count(typeUse, r.q.type),
      ];
    };
    const maintenanceRank = (r) => [
      count(familyUse, r.family),
      r.last.at,
      count(chapterUse, r.q.chapter),
    ];
    take("review", review, Math.ceil(target * 0.4), 1, reviewRank);
    take("probe", probe, Math.max(1, Math.round(target * 0.25)), 2, probeRank);
    pace = slowPractice(timed);
    const reserveCoverage = unseen.some((r) => !picked.has(r.signature));
    if (pace && target >= 5 && target - picked.size > Number(reserveCoverage)) {
      const pool = rows.filter(
        (r) => r.q.type === pace.type && r.last?.ok !== false,
      );
      take(
        "pace",
        pool,
        Math.min(
          target - picked.size - Number(reserveCoverage),
          Math.max(1, Math.floor(target / 7)),
        ),
        2,
        (r) => [
          r.last ? 1 : 0,
          pace.topics.has(r.topic) || pace.families.has(r.family) ? 0 : 1,
          count(familyUse, r.family),
          Math.abs(r.level - 2),
          r.last?.at || 0,
        ],
      );
    }
    take("coverage", unseen, target, 1, coverageRank);
    for (const cap of [2, Infinity]) {
      if (picked.size === target) break;
      take("review", review, target, cap, reviewRank);
      take("probe", probe, target, cap, probeRank);
      take("coverage", unseen, target, cap, coverageRank);
      take("maintenance", mastered, target, cap, maintenanceRank);
    }
  }
  const groups = Object.entries(titles)
    .filter(([key]) => grouped.has(key))
    .map(([key, label]) => {
      const picks = grouped.get(key);
      return {
        key,
        label,
        reason: describe(key, picks, chapters, pace),
        ids: picks.map((r) => r.q.id),
      };
    });
  const ids = groups.flatMap((g) => g.ids);
  let intro = attempts
    ? `依据当前题库的 ${attempts} 次已判分作答，`
    : "当前题库还没有已判分的作答，";
  intro += `本轮从 ${chapterUse.size} 章选出 ${ids.length} 道题。`;
  if (available < requested)
    intro += `当前共有 ${available} 道不同的题目可选。`;
  return {
    title: attempts ? "下一轮练习" : "起点摸底练习",
    intro,
    groups,
    ids,
  };
}
