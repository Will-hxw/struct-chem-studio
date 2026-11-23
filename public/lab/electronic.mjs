const SYSTEMS = {
  ethene: { name: "乙烯", formula: "C₂H₄", n: 2, electrons: 2 },
  butadiene: {
    name: "1,3-丁二烯",
    formula: "C₄H₆",
    n: 4,
    electrons: 4,
    reference: 4,
    refName: "两个孤立乙烯型双键",
  },
  allyl: {
    name: "烯丙基正离子",
    formula: "C₃H₅⁺",
    n: 3,
    electrons: 2,
    reference: 2,
    refName: "一个乙烯型双键与一个空 p 轨道",
  },
  benzene: {
    name: "苯",
    formula: "C₆H₆",
    n: 6,
    electrons: 6,
    ring: true,
    reference: 6,
    refName: "三个孤立乙烯型双键",
  },
};
const LETTERS = "SPDFGHIK";
const SUP = {
  0: "⁰",
  1: "¹",
  2: "²",
  3: "³",
  4: "⁴",
  5: "⁵",
  6: "⁶",
  7: "⁷",
  8: "⁸",
  9: "⁹",
};
const SUB = {
  0: "₀",
  1: "₁",
  2: "₂",
  3: "₃",
  4: "₄",
  5: "₅",
  6: "₆",
  7: "₇",
  8: "₈",
  9: "₉",
  "/": "/",
  "-": "₋",
};
const eps = 1e-9;
const sup = (n) => [...String(n)].map((x) => SUP[x] || x).join("");
const sub = (n) => [...String(n)].map((x) => SUB[x] || x).join("");
const clean = (n) => (Math.abs(n) < eps ? 0 : n);
const format = (n, p = 3) =>
  String(Number(clean(n).toFixed(p))).replace("-", "−");
const half = (twice) => (twice % 2 === 0 ? String(twice / 2) : twice + "/2");
const halfShow = (twice) => half(twice).replace("-", "−");
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ],
  );
const array = (n) => Array.from({ length: n }, (_, i) => i);
function orbitals(sys) {
  const { n, electrons, ring } = sys;
  const modes = [];
  const add = (lambda, coeff, tag) =>
    modes.push({ lambda: clean(lambda), coeff: coeff.map(clean), tag });
  if (ring) {
    add(
      2,
      array(n).map(() => 1 / Math.sqrt(n)),
      "k=0",
    );
    for (let k = 1; k < n / 2; k++) {
      for (const [label, f] of [
        ["cos", Math.cos],
        ["sin", Math.sin],
      ]) {
        add(
          2 * Math.cos((2 * Math.PI * k) / n),
          array(n).map((j) => Math.sqrt(2 / n) * f((2 * Math.PI * k * j) / n)),
          label + " · k=" + k,
        );
      }
    }
    add(
      -2,
      array(n).map((j) => (-1) ** j / Math.sqrt(n)),
      "k=" + n / 2,
    );
  } else {
    for (let k = 1; k <= n; k++) {
      add(
        2 * Math.cos((k * Math.PI) / (n + 1)),
        array(n).map(
          (j) =>
            Math.sqrt(2 / (n + 1)) *
            Math.sin(((j + 1) * k * Math.PI) / (n + 1)),
        ),
        "k=" + k,
      );
    }
  }
  const groups = [];
  modes.forEach((o, i) => {
    const g = groups[groups.length - 1];
    if (g && Math.abs(o.lambda - modes[g[0]].lambda) < eps) g.push(i);
    else groups.push([i]);
  });
  let remaining = electrons;
  for (const g of groups) {
    g.forEach((i) => (modes[i].occ = 0));
    for (let pass = 0; pass < 2; pass++)
      for (const i of g)
        if (remaining > 0) {
          modes[i].occ++;
          remaining--;
        }
  }
  const homo = Math.min(...modes.filter((o) => o.occ).map((o) => o.lambda));
  const lumo = Math.max(...modes.filter((o) => o.occ < 2).map((o) => o.lambda));
  for (const o of modes)
    o.frontier =
      Math.abs(o.lambda - homo) < eps
        ? "HOMO"
        : Math.abs(o.lambda - lumo) < eps
          ? "LUMO"
          : "";
  return {
    modes,
    groups,
    total: modes.reduce((v, o) => v + o.occ * o.lambda, 0),
  };
}
function termModel(q) {
  // Bits correspond to (m_l, 2m_s) = (-1,+1), (-1,-1), (0,+1), ...
  const cells = new Map();
  for (let mask = 0; mask < 64; mask++) {
    const occ = array(6).filter((i) => mask & (1 << i));
    if (occ.length !== q) continue;
    const ml = occ.reduce((a, i) => a + Math.floor(i / 2) - 1, 0),
      ms = occ.reduce((a, i) => a + (i % 2 === 0 ? 1 : -1), 0);
    const key = ml + "," + ms;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(mask);
  }
  const mlMax = Math.max(
    ...[...cells.keys()].map((k) => Math.abs(+k.split(",")[0])),
  );
  const msMax = Math.max(
    ...[...cells.keys()].map((k) => Math.abs(+k.split(",")[1])),
  );
  const terms = [];
  const remaining = new Map([...cells].map(([k, v]) => [k, v.length]));
  // Highest-weight subtraction: largest available M_S, then largest M_L.
  for (let s = msMax; s >= 0; s -= 2) {
    for (let l = mlMax; l >= 0; l--) {
      const times = remaining.get(l + "," + s) || 0;
      for (let t = 0; t < times; t++) {
        const js = [];
        for (let j = Math.abs(2 * l - s); j <= 2 * l + s; j += 2) js.push(j);
        terms.push({
          s,
          l,
          label: sup(s + 1) + LETTERS[l] + (q % 2 ? "°" : ""),
          deg: (s + 1) * (2 * l + 1),
          js,
        });
        for (let m = -l; m <= l; m++)
          for (let z = -s; z <= s; z += 2) {
            const k = m + "," + z;
            remaining.set(k, (remaining.get(k) || 0) - 1);
          }
      }
    }
  }
  const ground = terms[0],
    jGround = q <= 3 ? ground.js[0] : ground.js[ground.js.length - 1];
  return {
    cells,
    mlMax,
    msMax,
    terms,
    ground,
    jGround,
    total: [...cells.values()].reduce((n, row) => n + row.length, 0),
  };
}
function eFormula(lambda) {
  if (Math.abs(lambda) < eps) return "α";
  const a = Math.abs(lambda);
  const known = [
    [Math.sqrt(2), "√2"],
    [(Math.sqrt(5) + 1) / 2, "1.618"],
    [(Math.sqrt(5) - 1) / 2, "0.618"],
  ];
  const coeff =
    Math.abs(a - 1) < eps
      ? ""
      : (known.find(([v]) => Math.abs(v - a) < eps)?.[1] ?? format(a));
  return "α " + (lambda > 0 ? "+" : "−") + " " + coeff + "β";
}
function specLabel(t, j) {
  const base = sup(t.s + 1) + LETTERS[t.l];
  const index = half(j);
  return (
    base +
    "<sub>" +
    escape(index) +
    "</sub>" +
    (t.label.endsWith("°") ? "<sup>°</sup>" : "")
  );
}
function btn(name, group, value, active, cls = "") {
  return (
    '<button type="button" class="elab-button ' +
    cls +
    '" data-gr="' +
    group +
    '" data-val="' +
    escape(value) +
    '" aria-pressed="' +
    active +
    '">' +
    name +
    "</button>"
  );
}
function energyChart(sys, model, active) {
  const { modes, groups } = model;
  const x = 76,
    w = 157,
    top = 27,
    bot = 224;
  const y = (l) => top + ((l + 2.22) / 4.44) * (bot - top);
  const pal = ["#315249", "#147863"];
  let svg =
    '<svg class="elab-energy" viewBox="0 0 332 251" role="img" aria-label="分子轨道能级图，向上能量升高"><g font-family="system-ui,sans-serif">';
  svg +=
    '<path d="M 45 ' +
    bot +
    ' V 17 m -4 6 l 4 -6 4 6" fill="none" stroke="#6d827b" stroke-width="1.4"/><text x="33" y="15" text-anchor="end" fill="#50665e" font-size="14">E</text>';
  for (const g of groups) {
    const lambda = modes[g[0]].lambda,
      cy = y(lambda),
      selected = g.includes(active),
      col = selected ? pal[1] : pal[0];
    svg +=
      '<line x1="50" x2="311" y1="' +
      cy +
      '" y2="' +
      cy +
      '" stroke="#d1ded8" stroke-dasharray="3 5"/>';
    if (selected)
      svg +=
        '<rect x="55" y="' +
        (cy - 15) +
        '" width="255" height="30" fill="#deeee7" rx="6"/>';
    const step = w / g.length;
    g.forEach((i, pos) => {
      const cx = x + (pos + 0.5) * step,
        orb = modes[i],
        width = g.length > 1 ? 29 : 45;
      const lw = i === active ? 3.4 : 2;
      svg +=
        '<path d="M ' +
        (cx - width) +
        " " +
        cy +
        " H " +
        (cx + width) +
        '" fill="none" stroke="' +
        col +
        '" stroke-width="' +
        lw +
        '"/>';
      if (orb.occ > 0)
        svg +=
          '<path d="M ' +
          (cx - 5) +
          " " +
          (cy + 7) +
          ' v -19 l -3 5 m 3 -5 3 5" fill="none" stroke="' +
          col +
          '" stroke-width="1.8"/>';
      if (orb.occ === 2)
        svg +=
          '<path d="M ' +
          (cx + 5) +
          " " +
          (cy - 12) +
          ' v 19 l -3 -5 m 3 5 3 -5" fill="none" stroke="' +
          col +
          '" stroke-width="1.8"/>';
    });
    svg +=
      '<text x="238" y="' +
      (cy + 4) +
      '" fill="' +
      col +
      '" font-size="13">' +
      escape(eFormula(lambda)) +
      "</text>";
  }
  return svg + "</g></svg>";
}
function phaseDiagram(sys, orb) {
  const { coeff } = orb,
    n = sys.n;
  const coords = array(n).map((i) =>
    sys.ring
      ? [
          159 + 68 * Math.cos(((-90 + (i * 360) / n) * Math.PI) / 180),
          104 + 68 * Math.sin(((-90 + (i * 360) / n) * Math.PI) / 180),
        ]
      : [
          n === 2 ? 88 + 142 * i : 45 + (i * 228) / (n - 1),
          99 + (i % 2 ? 9 : -9),
        ],
  );
  let ans =
    '<svg class="elab-phase" viewBox="0 0 320 210" role="img" aria-label="选中轨道在各个碳 p 基函数上的实系数和相位">';
  for (let j = 0; j < (sys.ring ? n : n - 1); j++) {
    const a = coords[j],
      b = coords[(j + 1) % n];
    ans +=
      '<line x1="' +
      a[0] +
      '" y1="' +
      a[1] +
      '" x2="' +
      b[0] +
      '" y2="' +
      b[1] +
      '" stroke="#90ada1" stroke-width="2"/>';
  }
  coords.forEach(([x, y], i) => {
    const c = coeff[i],
      z = Math.abs(c) < eps,
      r = z ? 9 : 10 + 16 * Math.abs(c);
    ans +=
      '<circle cx="' +
      x +
      '" cy="' +
      y +
      '" r="' +
      r +
      '" fill="' +
      (z ? "#fff" : c > 0 ? "#257a65" : "#cb8255") +
      '" stroke="' +
      (z ? "#8c9e97" : "#fff") +
      '" stroke-width="2"/><text x="' +
      x +
      '" y="' +
      (y + 5) +
      '" text-anchor="middle" font-size="16" font-weight="700" fill="' +
      (z ? "#607068" : "#fff") +
      '">' +
      (z ? "0" : c > 0 ? "+" : "−") +
      "</text>";
    let lx = x,
      ly = y + r + 17;
    if (sys.ring) {
      const dx = x - 159,
        dy = y - 104,
        sz = Math.hypot(dx, dy);
      lx = x + ((r + 13) * dx) / sz;
      ly = y + ((r + 13) * dy) / sz + 4;
    }
    ans +=
      '<text x="' +
      lx +
      '" y="' +
      ly +
      '" text-anchor="middle" fill="#425d50" font-family="system-ui,sans-serif" font-size="13">C' +
      sub(i + 1) +
      "</text>";
  });
  return ans + "</svg>";
}
function huckelView(key, index) {
  const sys = SYSTEMS[key],
    model = orbitals(sys),
    orb = model.modes[index];
  const sum = format(model.total),
    stable = sys.reference !== undefined ? model.total - sys.reference : 0;
  const eq =
    Math.abs(model.total - Math.round(model.total)) < eps ? " = " : " ≈ ";
  const orbEq = sys.n === 4 && !sys.ring ? " ≈ " : " = ";
  let html =
    '<div class="elab-switch" aria-label="选择共轭体系">' +
    Object.entries(SYSTEMS)
      .map(([k, s]) => btn(escape(s.name), "system", k, key === k))
      .join("") +
    "</div>";
  html +=
    '<div class="elab-head"><div><h3>' +
    sys.name +
    " <span>" +
    sys.formula +
    "</span></h3><p>" +
    sys.n +
    " 个 p 轨道 · " +
    sys.electrons +
    " 个 π 电子 · β &lt; 0</p></div></div>";
  html +=
    '<div class="elab-duo"><section class="elab-panel"><h4>π 轨道能级与占据</h4>' +
    energyChart(sys, model, index) +
    '<p class="elab-cap">能量向上升高。每根短线代表一个空间轨道，两支反向箭头代表一对电子。</p></section>';
  html +=
    '<section class="elab-panel"><h4>轨道 ' +
    (index + 1) +
    " 的相对相位</h4>" +
    phaseDiagram(sys, orb) +
    '<p class="elab-cap">同侧 p 轨道叶瓣的颜色和正负号表示相位，圆圈大小随系数绝对值变化。0 表示原子处系数为零。</p></section></div>';
  html +=
    '<div class="elab-group"><strong>选择轨道</strong><div class="elab-switch">' +
    model.modes
      .map((o, i) =>
        btn(
          "ψ" + sub(i + 1) + (o.frontier ? " · " + o.frontier : ""),
          "orb",
          i,
          i === index,
        ),
      )
      .join("") +
    "</div></div>";
  html +=
    '<p class="elab-inline"><strong>ψ' +
    sub(index + 1) +
    "</strong>　ε" +
    orbEq +
    eFormula(orb.lambda) +
    "　·　占据 " +
    orb.occ +
    " 个电子" +
    (sys.ring ? "　·　" + orb.tag : "") +
    "</p>";
  html +=
    '<div class="elab-coeff">' +
    orb.coeff
      .map(
        (v, j) => "<span>C" + sub(j + 1) + " <b>" + format(v) + "</b></span>",
      )
      .join("") +
    "</div>";
  if (sys.ring)
    html +=
      '<p class="elab-note">苯的简并能级选用一组实的 cos、sin 正交基。改变简并轨道的线性组合会改变单轨道相位图，能级与整组占据不变。</p>';
  html +=
    '<section class="elab-summary"><h4>总 π 电子能量</h4><p>Eπ' +
    eq +
    sys.electrons +
    "α + " +
    sum +
    "β</p>";
  if (sys.reference !== undefined)
    html +=
      "<p>以" +
      sys.refName +
      "为局域参考，E局域 = " +
      sys.electrons +
      "α + " +
      sys.reference +
      "β。按正的能量降低量定义，<b>E局域 − Eπ" +
      eq +
      "−" +
      (Math.abs(stable - 1) < eps ? "" : format(stable)) +
      "β &gt; 0</b>。</p>";
  else
    html +=
      "<p>两个电子占据成键 π 轨道。孤立乙烯的总 π 能量可作为较长共轭体系的局域参考。</p>";
  return html + "</section>";
}
function termsView(q, cell, term) {
  const model = termModel(q),
    { cells, terms, ground, jGround, mlMax, msMax, total } = model;
  const [ml, ms] = cell.split(",").map(Number),
    selected = term == null ? null : terms[term],
    masks = cells.get(cell) || [];
  const belongs = (l, s) =>
    selected && Math.abs(l) <= selected.l && Math.abs(s) <= selected.s;
  let html =
    '<div class="elab-switch" aria-label="选择 p 亚层组态">' +
    array(6)
      .map((i) => btn("p" + sup(i + 1), "config", i + 1, q === i + 1))
      .join("") +
    "</div>";
  html +=
    '<div class="elab-head"><div><h3>p' +
    sup(q) +
    " 的微观状态</h3><p>6 个自旋轨道选 " +
    q +
    " 个 · C(6, " +
    q +
    ") = " +
    total +
    " 种占据</p></div></div>";
  html +=
    '<div class="elab-terms-grid"><section class="elab-panel"><h4>投影分布</h4><p class="elab-cap">列为总轨道投影 M<sub>L</sub>，行为总自旋投影 M<sub>S</sub>。点击非零格查看其全部占据方式。</p>';
  html +=
    '<div class="elab-scroll"><table class="elab-table"><caption>M<sub>S</sub> 与 M<sub>L</sub> 的微观状态数</caption><thead><tr><th scope="col">M<sub>S</sub> ＼ M<sub>L</sub></th>';
  for (let l = -mlMax; l <= mlMax; l++)
    html += '<th scope="col">' + format(l) + "</th>";
  html += "</tr></thead><tbody>";
  for (let s = msMax; s >= -msMax; s -= 2) {
    html += '<tr><th scope="row">' + halfShow(s) + "</th>";
    for (let l = -mlMax; l <= mlMax; l++) {
      const key = l + "," + s,
        count = (cells.get(key) || []).length;
      html +=
        '<td class="' +
        (belongs(l, s) ? "elab-covered" : "") +
        '">' +
        (count
          ? '<button type="button" class="elab-cell" data-gr="cell" data-val="' +
            key +
            '" aria-pressed="' +
            (key === cell) +
            '" aria-label="M L 为 ' +
            l +
            "，M S 为 " +
            halfShow(s) +
            "，有 " +
            count +
            ' 个微观状态">' +
            count +
            "</button>"
          : '<span class="elab-zero">0</span>') +
        "</td>";
    }
    html += "</tr>";
  }
  html += "</tbody></table></div>";
  if (selected)
    html +=
      '<p class="elab-hint">淡绿色区域显示 ' +
      selected.label +
      " 在各投影格的贡献，每格贡献 1 个态。格中数字仍是全部谱项的总计。</p>";
  html +=
    '</section><section class="elab-panel"><h4>M<sub>L</sub> = ' +
    format(ml) +
    "，M<sub>S</sub> = " +
    halfShow(ms) +
    '</h4><p class="elab-cap">本格有 ' +
    masks.length +
    " 种满足泡利原理的排布。↑ 与 ↓ 分别表示 m<sub>s</sub> = +½、−½。</p>";
  html +=
    '<div class="elab-scroll"><table class="elab-table elab-config-table"><caption>三种 mℓ 轨道上的电子</caption><thead><tr><th scope="col">排布</th><th scope="col">mℓ = −1</th><th scope="col">mℓ = 0</th><th scope="col">mℓ = +1</th></tr></thead><tbody>';
  masks.forEach((mask, i) => {
    html += '<tr><th scope="row">' + (i + 1) + "</th>";
    for (let a = 0; a < 3; a++) {
      const up = Boolean(mask & (1 << (2 * a))),
        down = Boolean(mask & (1 << (2 * a + 1)));
      const ar = up && down ? "↑↓" : up ? "↑" : down ? "↓" : "—";
      html +=
        '<td aria-label="' +
        (up && down ? "双占" : up ? "向上自旋" : down ? "向下自旋" : "未占据") +
        '"><span class="elab-spin">' +
        ar +
        "</span></td>";
    }
    html += "</tr>";
  });
  html += "</tbody></table></div></section></div>";
  html +=
    '<div class="elab-group"><strong>按谱项查看</strong><div class="elab-switch">' +
    btn("全部", "term", "all", term == null) +
    terms
      .map((t, i) =>
        btn(t.label + " · " + t.deg + " 态", "term", i, term === i),
      )
      .join("") +
    "</div></div>";
  if (selected) {
    html +=
      '<p class="elab-inline"><b>' +
      selected.label +
      "</b>　S = " +
      halfShow(selected.s) +
      "　·　L = " +
      selected.l +
      "　·　J = " +
      selected.js.map(halfShow).join("、") +
      "</p>";
    html +=
      '<p class="elab-note">同一投影格内的占据排布不一定是 L²、S² 的共同本征态。谱项分布只给出该格中各谱项的态数，具体本征态可由多个排布线性组合得到。</p>';
  }
  html +=
    '<section class="elab-summary"><h4>谱项计数与基态</h4><p>各项简并度 (2S + 1)(2L + 1) 之和为 ' +
    terms.map((t) => t.deg).join(" + ") +
    (terms.length > 1 ? " = " + total : "") +
    "，与占据数 C(6, " +
    q +
    ") 相等。</p>";
  html +=
    "<p>洪特规则给出的最低能级为 <b>" +
    specLabel(ground, jGround) +
    "</b>。" +
    (ground.js.length === 1
      ? "该项只有一个可取的 J。"
      : q < 3
        ? "该亚层少于半满，在最低项中取最小 J。"
        : "该亚层多于半满，在最低项中取最大 J。") +
    (q % 2 ? "　° 表示该组态具有奇宇称。" : "") +
    "</p></section>";
  return html;
}
function presetSystem(v) {
  const str = String(v || "")
    .toLowerCase()
    .trim();
  const alias = {
    乙烯: "ethene",
    ethylene: "ethene",
    丁二烯: "butadiene",
    "1,3-丁二烯": "butadiene",
    烯丙基正离子: "allyl",
    "allyl-cation": "allyl",
    苯: "benzene",
  };
  const key = alias[str] || str;
  return Object.hasOwn(SYSTEMS, key) ? key : "butadiene";
}
function presetConfig(v) {
  const str = String(v || "")
    .toLowerCase()
    .trim()
    .replace(/\^/g, "");
  for (let i = 1; i <= 6; i++)
    if ([String(i), "p" + i, "p" + sup(i)].includes(str)) return i;
  return 2;
}
function initialCell(q) {
  const m = termModel(q);
  return [...m.cells.entries()].sort(
    ([a, values], [b, other]) =>
      other.length - values.length ||
      Math.abs(+a.split(",")[0]) - Math.abs(+b.split(",")[0]) ||
      +b.split(",")[1] - +a.split(",")[1],
  )[0][0];
}
export function mountElectronic(container, { kind = "huckel", preset } = {}) {
  if (!container || typeof container.appendChild !== "function")
    throw new TypeError("需要有效的插图容器。");
  if (!["huckel", "terms"].includes(kind))
    throw new TypeError("未知的教学插图。");
  const host = container.ownerDocument.createElement("div");
  host.className = "elab-root";
  container.appendChild(host);
  let system = presetSystem(preset),
    orbIndex = 0,
    q = presetConfig(preset),
    cell = initialCell(q),
    term = null;
  const initialOrb = (key) =>
    orbitals(SYSTEMS[key]).modes.findIndex((o) => o.frontier === "HOMO");
  orbIndex = initialOrb(system);
  const render = () => {
    host.innerHTML =
      kind === "huckel"
        ? huckelView(system, orbIndex)
        : termsView(q, cell, term);
  };
  const onClick = (e) => {
    const target = e.target.closest?.("button[data-gr]");
    if (!target || !host.contains(target)) return;
    const gr = target.dataset.gr,
      val = target.dataset.val;
    switch (gr) {
      case "system":
        system = presetSystem(val);
        orbIndex = initialOrb(system);
        break;
      case "orb":
        orbIndex = Number(val);
        break;
      case "config":
        q = presetConfig(val);
        cell = initialCell(q);
        term = null;
        break;
      case "term":
        term = val === "all" ? null : Number(val);
        break;
      case "cell":
        cell = val;
        break;
      default:
        return;
    }
    render();
    const restored = [...host.querySelectorAll("button[data-gr]")].find(
      (b) => b.dataset.gr === gr && b.dataset.val === val,
    );
    restored?.focus({ preventScroll: true });
  };
  render();
  host.addEventListener("click", onClick);
  return () => {
    host.removeEventListener("click", onClick);
    host.remove();
  };
}
