// Idealized molecular geometry and conventional single-atom cubic unit cells.
const zAxis = [0, 0, 1],
  xAxis = [1, 0, 0],
  yAxis = [0, 1, 0];
const dot = (a, b) => a.reduce((v, x, i) => v + x * b[i], 0);
const times = (a, k) => a.map((x) => x * k);
const plus = (a, b) => a.map((v, i) => v + b[i]);
const minus = (a, b) => a.map((v, i) => v - b[i]);
const norm = (v) => Math.hypot(...v);
const unit = (v) => times(v, 1 / norm(v));
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const deg = (a) => (a * Math.PI) / 180;
const rotate = (n, label, axis = zAxis) => ({
  kind: "rotation",
  axis: unit(axis),
  angle: (2 * Math.PI) / n,
  label,
});
const mirror = (normal, label) => ({
  kind: "reflection",
  normal: unit(normal),
  label,
});
const invert = { kind: "inversion", label: "i · 关于原点反演" };
const xy = mirror(zAxis, "σ · xy 面反射"),
  xz = mirror(yAxis, "σ · xz 面反射"),
  yz = mirror(xAxis, "σ · yz 面反射");
const cz2 = rotate(2, "C₂ · 绕 z 轴转 180°"),
  cz3 = rotate(3, "C₃ · 绕 z 轴转 120°");
const atom = (el, p) => ({ el, p });
const ring = (n, r, z = 0, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n + offset;
    return [r * Math.cos(a), r * Math.sin(a), z];
  });
const star = (n) => Array.from({ length: n }, (_, i) => [0, i + 1]);
const central = (el, wing, coords) => [
  atom(el, [0, 0, 0]),
  ...coords.map((p) => atom(wing, p)),
];
function bent(left, right, a, r1, r2) {
  const h = deg(a / 2);
  return [
    atom("O", [0, 0, 0]),
    atom(left, [-r1 * Math.sin(h), 0, r1 * Math.cos(h)]),
    atom(right, [r2 * Math.sin(h), 0, r2 * Math.cos(h)]),
  ];
}
function makeMolecule(name, group, hint, atoms, bonds, ops) {
  const totals = {};
  for (const a of atoms) totals[a.el] = (totals[a.el] || 0) + 1;
  const seen = {};
  for (const a of atoms) {
    seen[a.el] = (seen[a.el] || 0) + 1;
    a.id = a.el + (totals[a.el] > 1 ? seen[a.el] : "");
  }
  return { name, group, hint, atoms, bonds, ops };
}
function ethane(staggered) {
  const atoms = [
    atom("C", [0, 0, 0.77]),
    atom("C", [0, 0, -0.77]),
    ...ring(3, 1.03, 1.14).map((p) => atom("H", p)),
    ...ring(3, 1.03, -1.14, staggered ? Math.PI / 3 : 0).map((p) =>
      atom("H", p),
    ),
  ];
  return makeMolecule(
    staggered ? "交叉式乙烷" : "重叠式乙烷",
    staggered ? "D₃d" : "D₃h",
    staggered
      ? "沿 C—C 键观察，两端的 C—H 键错开 60°。反演中心在 C—C 键的中点。"
      : "沿 C—C 键观察，两端的 C—H 键重叠。xy 平面平分 C—C 键。",
    atoms,
    [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [1, 5],
      [1, 6],
      [1, 7],
    ],
    staggered ? [invert, cz3, xz, xy] : [xy, cz3, xz, invert],
  );
}
export const molecules = {
  h2o: makeMolecule(
    "水 H₂O",
    "C₂v",
    "分子位于 xz 面。z 轴穿过氧原子，处在分子平面内，并平分 H—O—H 键角。",
    bent("H", "H", 104.5, 0.958, 0.958),
    star(2),
    [cz2, xz, yz, rotate(2, "候选 C₂ · 绕 y 轴转 180°", yAxis)],
  ),
  hocl: makeMolecule(
    "次氯酸 HOCl",
    "Cₛ",
    "H—O—Cl 位于 xz 面，键角约 102.45°。z 轴平分键角，但两端元素和键长均不同。",
    bent("H", "Cl", 102.45, 0.973, 1.697),
    star(2),
    [xz, cz2, yz, invert],
  ),
  nh3: makeMolecule(
    "氨 NH₃",
    "C₃v",
    "三角锥形。z 轴穿过氮原子和三个氢原子形成的等边三角形中心。",
    central("N", "H", ring(3, 0.95, -0.39)),
    star(3),
    [cz3, xz, xy],
  ),
  bf3: makeMolecule(
    "三氟化硼 BF₃",
    "D₃h",
    "三个 F 原子在 xy 面内围成等边三角形，z 轴垂直于分子平面。",
    central("B", "F", ring(3, 1.31)),
    star(3),
    [cz3, xy, xz, invert],
  ),
  ch4: makeMolecule(
    "甲烷 CH₄",
    "T_d",
    "四面体构型。[111] 方向穿过中心碳及 H1，其余三个 H 构成垂直于该方向的三角形。",
    central(
      "C",
      "H",
      [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ].map((v) => times(unit(v), 1.09)),
    ),
    star(4),
    [
      rotate(3, "C₃ · 绕 [111] 轴转 120°", [1, 1, 1]),
      cz2,
      mirror([1, -1, 0], "σ · x＝y 面反射"),
      invert,
    ],
  ),
  benzene: makeMolecule(
    "苯 C₆H₆",
    "D₆h",
    "六个碳原子构成 xy 面内的正六边形。原点位于环心，z 轴垂直环面。",
    [
      ...ring(6, 1.4).map((p) => atom("C", p)),
      ...ring(6, 2.47).map((p) => atom("H", p)),
    ],
    [
      ...Array.from({ length: 6 }, (_, i) => [i, (i + 1) % 6]),
      ...Array.from({ length: 6 }, (_, i) => [i, i + 6]),
    ],
    [
      rotate(6, "C₆ · 绕 z 轴转 60°"),
      rotate(2, "C₂ · 绕 x 轴转 180°", xAxis),
      xy,
      invert,
    ],
  ),
  sf6: makeMolecule(
    "六氟化硫 SF₆",
    "Oₕ",
    "六个 F 位于 ±x、±y、±z 轴上，硫原子位于理想正八面体中心。",
    central(
      "S",
      "F",
      [
        xAxis,
        times(xAxis, -1),
        yAxis,
        times(yAxis, -1),
        zAxis,
        times(zAxis, -1),
      ].map((p) => times(p, 1.56)),
    ),
    star(6),
    [
      rotate(4, "C₄ · 绕 z 轴转 90°"),
      rotate(3, "C₃ · 绕 [111] 轴转 120°", [1, 1, 1]),
      xz,
      invert,
    ],
  ),
  staggered: ethane(true),
  eclipsed: ethane(false),
};
export function transformPoint(p, op, t = 1) {
  if (op.kind === "inversion") return times(p, 1 - 2 * t);
  if (op.kind === "reflection")
    return minus(p, times(op.normal, 2 * t * dot(p, op.normal)));
  const a = op.axis,
    th = op.angle * t,
    c = Math.cos(th),
    s = Math.sin(th);
  return plus(
    plus(times(p, c), times(cross(a, p), s)),
    times(a, dot(a, p) * (1 - c)),
  );
}
export function atomMapping(mol, op) {
  const used = new Set();
  const pairs = mol.atoms.map((a) => {
    const p = transformPoint(a.p, op);
    const j = mol.atoms.findIndex(
      (b, i) => !used.has(i) && a.el === b.el && norm(minus(p, b.p)) < 1e-6,
    );
    if (j >= 0) used.add(j);
    return { from: a.id, to: j < 0 ? null : mol.atoms[j].id };
  });
  return { valid: pairs.every((p) => p.to !== null), pairs };
}
const cornerCoords = [];
for (const x of [-1, 1])
  for (const y of [-1, 1])
    for (const z of [-1, 1]) cornerCoords.push([x, y, z]);
const cellsEdges = [];
for (let i = 0; i < 8; i++)
  for (let j = i + 1; j < 8; j++)
    if (norm(minus(cornerCoords[i], cornerCoords[j])) === 2)
      cellsEdges.push([i, j]);
const centerFaces = [
  xAxis,
  times(xAxis, -1),
  yAxis,
  times(yAxis, -1),
  zAxis,
  times(zAxis, -1),
];
function crystal(name, symbol, extra, Z, cn, count, contact) {
  const atoms = [...cornerCoords.map((p) => atom("顶点", p)), ...extra];
  return { name, symbol, atoms, bonds: cellsEdges, Z, cn, count, contact };
}
export const crystals = {
  sc: crystal("简单立方", "SC", [], 1, 6, "8 × ⅛ ＝ 1", "棱长 a＝2r"),
  bcc: crystal(
    "体心立方",
    "BCC",
    [atom("体心", [0, 0, 0])],
    2,
    8,
    "8 × ⅛ ＋ 1 ＝ 2",
    "体对角线 √3a＝4r",
  ),
  fcc: crystal(
    "面心立方",
    "FCC",
    centerFaces.map((p) => atom("面心", p)),
    4,
    12,
    "8 × ⅛ ＋ 6 × ½ ＝ 4",
    "面对角线 √2a＝4r",
  ),
};
const alias = {
  water: "h2o",
  CH4: "ch4",
  C6H6: "benzene",
  c6h6: "benzene",
  "C₂H₆（交叉式）": "staggered",
  "ethane-staggered": "staggered",
  "ethane-eclipsed": "eclipsed",
  简单立方: "sc",
  体心立方: "bcc",
  面心立方: "fcc",
};
const palette = {
  H: ["#dddcc9", "#ffffff", "氢"],
  C: ["#347763", "#c5e7d0", "碳"],
  O: ["#aa5245", "#ffc1a3", "氧"],
  Cl: ["#4d8d31", "#cbeaa9", "氯"],
  N: ["#4976aa", "#bfd9fb", "氮"],
  F: ["#4a9b86", "#c3eddc", "氟"],
  B: ["#b27c72", "#f4d4c9", "硼"],
  S: ["#b18b2f", "#ffe7a2", "硫"],
  顶点: ["#437e67", "#d6e8cc", "顶点"],
  体心: ["#ae7249", "#ffcf9b", "体心"],
  面心: ["#507f9e", "#d2e5f2", "面心"],
};
const diags = {
  edge: [
    [-1, -1, -1],
    [1, -1, -1],
  ],
  face: [
    [-1, -1, 1],
    [1, 1, 1],
  ],
  body: [
    [-1, -1, -1],
    [1, 1, 1],
  ],
};
const diagText = {
  edge: "棱 · a",
  face: "面对角线 · √2a",
  body: "体对角线 · √3a",
  none: "仅显示晶胞",
};
function node(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = "geom-" + cls;
  if (text != null) e.textContent = text;
  return e;
}
function button(label, cls = "btn") {
  const b = node("button", cls, label);
  b.type = "button";
  return b;
}
function selectField(caption) {
  const label = node("label", "field");
  const cap = node("span", null, caption);
  const select = node("select", "select");
  label.append(cap, select);
  return { label, select };
}
function setOptions(select, list) {
  select.replaceChildren(
    ...list.map(([v, t]) => {
      const o = node("option", null, t);
      o.value = v;
      return o;
    }),
  );
}
function projection(p, yaw, elev) {
  const a = Math.cos(yaw),
    b = Math.sin(yaw),
    c = Math.cos(elev),
    s = Math.sin(elev);
  const front = p[0] * b - p[1] * a;
  return [p[0] * a + p[1] * b, p[2] * c - front * s, front * c + p[2] * s];
}
export function mountGeometry(container, { kind = "molecule", preset } = {}) {
  const molecular = kind !== "crystal",
    bank = molecular ? molecules : crystals;
  const fallback = molecular ? "h2o" : "sc";
  const req = String(preset || fallback),
    picked = bank[req] ? req : alias[req] || req.toLowerCase();
  let key = Object.hasOwn(bank, picked) ? picked : fallback;
  const root = node("section", "root");
  root.setAttribute(
    "aria-label",
    molecular ? "分子对称操作模型" : "立方晶胞模型",
  );
  const choices = node("div", "choices"),
    modelField = selectField(molecular ? "选择分子" : "选择晶胞"),
    opField = selectField(molecular ? "检验操作" : "几何辅助线");
  setOptions(
    modelField.select,
    Object.entries(bank).map(([k, m]) => [k, m.name]),
  );
  modelField.select.value = key;
  const go = molecular ? button("执行操作", "primary") : null;
  choices.append(modelField.label, opField.label);
  if (go) choices.append(go);
  const board = node("div", "board"),
    canvas = node("canvas", "canvas");
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "三维模型。拖动或使用方向键旋转，正负号缩放，Home 复位。",
  );
  const tag = node("div", "tag"),
    tools = node("div", "tools");
  const zoomOut = button("−", "tool"),
    zoomIn = button("＋", "tool"),
    reset = button("复位", "tool");
  zoomOut.setAttribute("aria-label", "缩小模型");
  zoomIn.setAttribute("aria-label", "放大模型");
  tools.append(zoomOut, zoomIn, reset);
  board.append(canvas, tag, tools);
  const switches = node("div", "switches");
  function checkbox(t, val) {
    const l = node("label", "check"),
      b = node("input");
    b.type = "checkbox";
    b.checked = val;
    l.append(b, document.createTextNode(t));
    switches.append(l);
    return b;
  }
  const axes = checkbox("坐标方向", true),
    guide = molecular ? checkbox("操作元素", true) : null,
    labels = molecular ? checkbox("原子编号", true) : null;
  const legend = node("div", "legend"),
    note = node("p", "hint"),
    readout = node("div", "result");
  readout.setAttribute("aria-live", "polite");
  const instruction = node("span", "gestures", "拖动旋转 · 方向键微调");
  switches.append(instruction);
  root.append(choices, board, switches, legend, note, readout);
  container.replaceChildren(root);
  const ctx = canvas.getContext("2d"),
    abort = new AbortController(),
    listen = (el, type, fn, opts = {}) =>
      el.addEventListener(type, fn, { ...opts, signal: abort.signal });
  let yaw = 0,
    elev = 0,
    zoom = 1,
    phase = 0,
    raf = 0,
    resizeRaf = 0,
    result = false,
    lastPointer = null;
  const minmax = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function getOp() {
    return molecular ? bank[key].ops[Number(opField.select.value) || 0] : null;
  }
  function pose() {
    if (molecular && (key === "h2o" || key === "hocl")) {
      yaw = -0.31;
      elev = 0.21;
    } else {
      yaw = -0.57;
      elev = 0.48;
    }
    zoom = 1;
  }
  function resize() {
    const w = board.clientWidth,
      h = board.clientHeight;
    if (w < 3 || h < 3) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function line(a, b, color, width = 1, dash = []) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.restore();
  }
  function txt(point, text, color = "#254f41", align = "center", size = 13) {
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.font = "600 " + size + 'px "Times New Roman","Microsoft YaHei","PingFang SC",sans-serif' ;
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(241,247,237,.91)";
    ctx.strokeText(text, point[0], point[1]);
    ctx.fillStyle = color;
    ctx.fillText(text, point[0], point[1]);
    ctx.restore();
  }
  function draw() {
    if (!ctx) return;
    const w = board.clientWidth,
      h = board.clientHeight;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const m = bank[key],
      op = getOp();
    const extent = Math.max(...m.atoms.map((a) => norm(a.p)), 0.75);
    const points = m.atoms.map((a) =>
      molecular ? transformPoint(a.p, op, phase) : a.p,
    );
    const center =
      molecular && (key === "h2o" || key === "hocl") ? [0, 0, 0.24] : [0, 0, 0];
    const scale = (Math.min(w * 0.38, h * 0.33) / extent) * zoom;
    const cx = w * 0.5,
      cy = h * 0.52;
    function screen(p) {
      const v = projection(minus(p, center), yaw, elev);
      return [cx + v[0] * scale, cy - v[1] * scale, v[2]];
    }
    const length = extent * 1.23;
    if (molecular && guide.checked) {
      if (op.kind === "reflection") {
        const normal = op.normal,
          u = unit(cross(normal, Math.abs(normal[2]) > 0.85 ? yAxis : zAxis)),
          v = cross(normal, u);
        const sq = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([i, j]) =>
          screen(
            plus(times(u, i * length * 0.77), times(v, j * length * 0.77)),
          ),
        );
        ctx.beginPath();
        sq.forEach((p, i) =>
          i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
        );
        ctx.closePath();
        ctx.fillStyle = "rgba(78,145,127,.13)";
        ctx.fill();
        ctx.strokeStyle = "#75a896";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (op.kind === "rotation") {
        line(
          screen(times(op.axis, -length)),
          screen(times(op.axis, length)),
          "#ac753d",
          1.8,
          [6, 4],
        );
        const tip = screen(times(op.axis, length));
        txt([tip[0] + 10, tip[1]], "轴", "#93622e", "left", 12);
      } else {
        const c = screen([0, 0, 0]);
        ctx.strokeStyle = "#a96c3c";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(c[0], c[1], 11, 0, Math.PI * 2);
        ctx.stroke();
        txt([c[0] + 15, c[1] - 13], "i", "#8a5633", "left", 13);
      }
    }
    if (molecular && phase > 0) {
      ctx.save();
      ctx.strokeStyle = "rgba(69,103,81,.55)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      for (const a of m.atoms) {
        const p = screen(a.p);
        ctx.beginPath();
        ctx.arc(p[0], p[1], 11 * zoom, 0, 2 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();
    }
    let objects = [];
    const grouped = points.map(screen),
      radii = m.atoms.map(
        (a) =>
          (molecular ? (a.el === "H" ? 11 : 16) : 11) *
          minmax(Math.min(w / 470, h / 310), 0.77, 1.2) *
          zoom,
      );
    m.bonds.forEach(([a, b]) => {
      const v = grouped[a],
        u = grouped[b];
      const mid = v.map((q, i) => (q + u[i]) / 2);
      // Splitting bonds at the midpoint preserves depth at crossings.
      for (const [start, end, index] of [
        [v, mid, a],
        [u, mid, b],
      ]) {
        const dx = end[0] - start[0],
          dy = end[1] - start[1],
          dist = Math.hypot(dx, dy);
        const retreat = Math.min(radii[index] * 0.83, dist);
        const start2 = [
          start[0] + (dx * retreat) / (dist || 1),
          start[1] + (dy * retreat) / (dist || 1),
        ];
        const color = molecular ? "#719787" : "#779887",
          width = molecular ? Math.min(8, 5.4 * zoom) : 1.7;
        objects.push({
          z: (start[2] + end[2]) / 2,
          paint: () => line(start2, end, color, width),
        });
      }
    });
    if (!molecular && diags[opField.select.value]) {
      const [a, b] = diags[opField.select.value].map(screen);
      objects.push({
        z: (a[2] + b[2]) / 2 + 0.001,
        paint: () => line(a, b, "#bd6e31", 3, [7, 4]),
      });
    }
    m.atoms.forEach((a, i) => {
      const p = grouped[i],
        r = radii[i],
        colors = palette[a.el],
        z = p[2];
      objects.push({
        z,
        paint: () => {
          const fill = ctx.createRadialGradient(
            p[0] - r * 0.35,
            p[1] - r * 0.38,
            r * 0.08,
            p[0],
            p[1],
            r,
          );
          fill.addColorStop(0, colors[1]);
          fill.addColorStop(0.85, colors[0]);
          fill.addColorStop(1, colors[0]);
          ctx.fillStyle = fill;
          ctx.strokeStyle = a.el === "H" ? "#97a493" : "#4e776549";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (molecular && labels.checked)
            txt([p[0], p[1] - r - 8], a.id, "#284b3e", "center", 12);
        },
      });
    });
    objects.sort((a, b) => a.z - b.z).forEach((o) => o.paint());
    if (axes.checked) {
      const anchor = [40, h - 37];
      for (const [vec, title, c] of [
        [xAxis, "x", "#9e634a"],
        [yAxis, "y", "#517a64"],
        [zAxis, "z", "#547b93"],
      ]) {
        const v = projection(vec, yaw, elev),
          e = [anchor[0] + v[0] * 22, anchor[1] - v[1] * 22];
        line(anchor, e, c, 1.7);
        txt(
          [anchor[0] + v[0] * 29, anchor[1] - v[1] * 29],
          title,
          c,
          "center",
          11,
        );
      }
    }
  }
  function clearAnimation() {
    cancelAnimationFrame(raf);
    raf = 0;
    result = false;
    phase = 0;
  }
  function summary() {
    readout.replaceChildren();
    const m = bank[key];
    if (!molecular) {
      const l = node("strong", null, "单原子常规晶胞");
      const p = node(
        "p",
        null,
        "晶胞含量 Z＝" + m.Z + "　·　最近邻配位数 " + m.cn,
      );
      const d = node(
        "p",
        null,
        "均摊计数　" + m.count + "。刚性等径球接触条件：" + m.contact + "。",
      );
      readout.append(l, p, d);
      return;
    }
    if (!result) {
      readout.append(
        node("strong", null, "先判断，再执行"),
        node("p", null, "操作后，每个原子能否与原位置上的同种元素重合？"),
      );
      return;
    }
    const answer = atomMapping(m, getOp());
    readout.append(
      node(
        "strong",
        answer.valid ? "valid" : "invalid",
        answer.valid ? "属于该分子的对称操作" : "分子不能完全重合",
      ),
    );
    const fixed = answer.pairs
      .filter((p) => p.from === p.to)
      .map((p) => p.from);
    const moved = answer.pairs
      .filter((p) => p.to && p.from !== p.to)
      .map((p) => p.from + " → " + p.to);
    const missed = answer.pairs.filter((p) => !p.to).map((p) => p.from);
    const p = node(
      "p",
      null,
      [
        fixed.length ? "原位：" + fixed.join("、") : "",
        moved.length ? "对应：" + moved.join("，") : "",
        missed.length ? "未落在同种元素原位：" + missed.join("、") : "",
      ]
        .filter(Boolean)
        .join("。") + "。",
    );
    readout.append(p);
  }
  function update() {
    clearAnimation();
    const m = bank[key];
    pose();
    if (molecular) {
      setOptions(
        opField.select,
        m.ops.map((o, i) => [i, o.label]),
      );
      tag.textContent = "理想点群 " + m.group;
      note.textContent = m.hint;
    } else {
      setOptions(opField.select, Object.entries(diagText));
      opField.select.value = { sc: "edge", bcc: "body", fcc: "face" }[key];
      tag.textContent = "常规晶胞 " + m.symbol;
      note.textContent =
        "球表示格点位置，大小为示意。顶点被 8 个晶胞共享，面心被 2 个共享，体心归一个晶胞。";
    }
    legend.replaceChildren();
    for (const el of new Set(m.atoms.map((a) => a.el))) {
      const item = node("span", "legend-item");
      const sw = node("i", "swatch");
      sw.style.background = palette[el][0];
      item.append(
        sw,
        document.createTextNode(molecular ? el + " " + palette[el][2] : el),
      );
      legend.append(item);
    }
    summary();
    draw();
  }
  function zoomBy(f) {
    zoom = minmax(zoom * f, 0.6, 1.85);
    draw();
  }
  function orbit(dx, dy) {
    yaw += dx;
    elev = minmax(elev + dy, -1.52, 1.52);
    draw();
  }
  listen(modelField.select, "change", () => {
    key = modelField.select.value;
    update();
  });
  listen(opField.select, "change", () => {
    clearAnimation();
    summary();
    draw();
  });
  if (go)
    listen(go, "click", () => {
      clearAnimation();
      summary();
      const reduced = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches,
        t0 = performance.now();
      if (reduced) {
        phase = 1;
        result = true;
        draw();
        summary();
        return;
      }
      function tick(now) {
        const t = minmax((now - t0) / 680, 0, 1);
        phase = t * t * (3 - 2 * t);
        draw();
        if (t < 1) raf = requestAnimationFrame(tick);
        else {
          raf = 0;
          result = true;
          summary();
        }
      }
      raf = requestAnimationFrame(tick);
    });
  listen(zoomIn, "click", () => zoomBy(1.15));
  listen(zoomOut, "click", () => zoomBy(1 / 1.15));
  listen(reset, "click", () => {
    clearAnimation();
    pose();
    summary();
    draw();
  });
  [axes, guide, labels]
    .filter(Boolean)
    .forEach((c) => listen(c, "change", draw));
  listen(canvas, "pointerdown", (event) => {
    if (lastPointer || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    lastPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.focus({ preventScroll: true });
  });
  listen(canvas, "pointermove", (event) => {
    if (lastPointer?.id !== event.pointerId) return;
    const dx = event.clientX - lastPointer.x,
      dy = event.clientY - lastPointer.y;
    lastPointer.x = event.clientX;
    lastPointer.y = event.clientY;
    orbit(dx * 0.012, dy * 0.012);
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(canvas, ev, (e) => {
      if (lastPointer?.id === e.pointerId) lastPointer = null;
    });
  listen(canvas, "keydown", (e) => {
    const actions = {
      ArrowLeft: () => orbit(-0.1, 0),
      ArrowRight: () => orbit(0.1, 0),
      ArrowUp: () => orbit(0, 0.1),
      ArrowDown: () => orbit(0, -0.1),
      "+": () => zoomBy(1.15),
      "=": () => zoomBy(1.15),
      "-": () => zoomBy(1 / 1.15),
      Home: () => reset.click(),
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  });
  listen(
    canvas,
    "wheel",
    (e) => {
      if (!e.ctrlKey && document.activeElement !== canvas) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.07 : 1 / 1.07);
    },
    { passive: false },
  );
  const observer =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          cancelAnimationFrame(resizeRaf);
          resizeRaf = requestAnimationFrame(resize);
        })
      : null;
  observer?.observe(board);
  if (!observer) listen(window, "resize", resize);
  update();
  resize();
  return () => {
    clearAnimation();
    cancelAnimationFrame(resizeRaf);
    observer?.disconnect();
    abort.abort();
    root.remove();
  };
}
