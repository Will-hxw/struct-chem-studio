function shuffled(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function makeOrders(questions, random = Math.random) {
  const out = {},
    groups = new Map();
  for (const q of questions) {
    if (!q?.options.length || q.type === "判断题") continue;
    if (q.answers.length !== 1) {
      out[q.id] = shuffled(q.options, random);
      continue;
    }
    const n = q.options.length;
    if (!groups.has(n)) groups.set(n, []);
    groups.get(n).push(q);
  }
  for (const [n, rows] of groups) {
    const positions = shuffled(
      Array.from({ length: n }, (_, i) => i),
      random,
    );
    const letters = shuffled(
      rows.map((_, i) => positions[i % n]),
      random,
    );
    rows.forEach((q, i) => {
      const ans = q.options[q.answers[0]],
        rest = shuffled(
          q.options.filter((x) => x !== ans),
          random,
        );
      rest.splice(letters[i], 0, ans);
      out[q.id] = rest;
    });
  }
  return out;
}
export function ordered(q, order) {
  if (
    !q ||
    !Array.isArray(order) ||
    order.length !== q.options.length ||
    new Set(order).size !== order.length ||
    !order.every((x) => q.options.includes(x))
  )
    return q;
  const right = new Set(q.answers.map((i) => q.options[i]));
  return {
    ...q,
    options: order,
    answers: order.flatMap((x, i) => (right.has(x) ? [i] : [])),
  };
}
