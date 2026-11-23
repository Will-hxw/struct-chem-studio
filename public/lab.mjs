import { rich } from "./deferred-notation.mjs";
import { icon, esc } from "./ui.mjs";
import { mountGeometry, molecules, crystals } from "./lab/geometry.mjs";
import { mountElectronic } from "./lab/electronic.mjs";
import { mountWaves, waveNames } from "./lab/waves.mjs";
const names = {
  molecule: Object.fromEntries(
    Object.entries(molecules).map(([k, v]) => [k, v.name]),
  ),
  crystal: Object.fromEntries(
    Object.entries(crystals).map(([k, v]) => [k, v.name]),
  ),
  huckel: {
    ethene: "乙烯",
    butadiene: "1,3-丁二烯",
    allyl: "烯丙基正离子",
    benzene: "苯",
  },
  terms: Object.fromEntries(
    ["¹", "²", "³", "⁴", "⁵", "⁶"].map((v, i) => [
      "p" + (i + 1),
      "p" + v + " 等价电子",
    ]),
  ),
  waves: waveNames,
};
export const labTabs = {
  molecule: {
    name: "分子点群",
    icon: "molecule",
    base: "h2o",
    desc: "拖动旋转分子，再执行一个候选操作，看等价原子能否重合。",
    source: ["分子对称性示例", "https://symotter.org/"],
    extra: [
      "次氯酸实验几何 · NIST",
      "https://cccbdb.nist.gov/expgeom2x.asp?casno=7790923",
    ],
  },
  waves: {
    name: "波函数与节点",
    icon: "wave",
    base: "2pz",
    desc: "对照波函数和概率密度，观察变号、节点与量子数的关系。",
    source: [
      "氢原子与量子数 · OpenStax",
      "https://openstax.org/books/university-physics-volume-3/pages/8-1-the-hydrogen-atom",
    ],
  },
  huckel: {
    name: "π 分子轨道",
    icon: "hex",
    base: "butadiene",
    desc: "切换能级，对照轨道相位、电子占据和离域稳定化能。",
    source: [
      "Hückel 分子轨道模型",
      "https://mochizuki-tus.github.io/QM_Textbook_EN/ch40_diatomic_mo_huckel.html",
    ],
  },
  terms: {
    name: "微观状态",
    icon: "spectrum",
    base: "p2",
    desc: "挑选投影格，查看泡利原理允许的排布，再用谱项简并度核对总数。",
    source: [
      "原子光谱与项符号 · NIST",
      "https://physics.nist.gov/Pubs/AtSpec/",
    ],
  },
  crystal: {
    name: "晶胞与堆积",
    icon: "stack",
    base: "fcc",
    desc: "旋转立方晶胞，沿棱、面对角线或体对角线检查接触条件与配位数。",
    source: [
      "晶格结构 · OpenStax",
      "https://openstax.org/books/chemistry-2e/pages/10-6-lattice-structures-in-crystalline-solids",
    ],
  },
};
export function labRoute(kind, preset) {
  const k = Object.hasOwn(labTabs, kind) ? kind : "molecule";
  return {
    kind: k,
    preset: Object.hasOwn(names[k], preset) ? preset : labTabs[k].base,
  };
}
export function visualFor(q) {
  const s = (q.stem + " " + q.topic)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‐‑–−]/g, "-");
  const m = q.chapter === 4 || /点群|对称操作|对称面/.test(s);
  if (m) {
    for (const [rx, k] of [
      [/hocl|次氯酸/, "hocl"],
      [/交叉式.{0,5}乙烷|乙烷.{0,5}交叉/, "staggered"],
      [/重叠式.{0,5}乙烷|乙烷.{0,5}重叠/, "eclipsed"],
      [/h2o|水分子/, "h2o"],
      [/nh3|氨分子/, "nh3"],
      [/bf3|三氟化硼/, "bf3"],
      [/ch4|甲烷/, "ch4"],
      [/sf6|六氟化硫/, "sf6"],
      [/c6h6|苯分子|苯环/, "benzene"],
    ])
      if (rx.test(s)) return labRoute("molecule", k);
  }
  if (q.chapter === 6 || /微观状态|谱项|光谱项/.test(s)) {
    const p = s.match(/p\s*\^?\s*([1-6])(?!\d)/);
    if (p) return labRoute("terms", "p" + p[1]);
  }
  if (q.chapter === 5 || /休克尔|hückel|离域能/.test(s)) {
    for (const [rx, k] of [
      [/丁二烯/, "butadiene"],
      [/烯丙基正离子|烯丙基阳离子/, "allyl"],
      [/苯环|苯的|苯分子|c6h6/, "benzene"],
      [/乙烯/, "ethene"],
    ])
      if (rx.test(s)) return labRoute("huckel", k);
  }
  if (q.chapter === 7) {
    for (const [rx, k] of [
      [/面心立方|fcc/, "fcc"],
      [/体心立方|bcc/, "bcc"],
      [/简单立方|原始立方/, "sc"],
    ])
      if (rx.test(s)) return labRoute("crystal", k);
  }
  if (q.chapter === 1 && /一维.{0,6}(箱|阱)|箱中粒子|一维势箱/.test(s))
    return labRoute("waves", "box");
  if (q.chapter === 2) {
    for (const [rx, k] of [
      [/3d[_\s]?z\^?2/, "3dz2"],
      [/2p[_\s]?z/, "2pz"],
      [/2s/, "2s"],
      [/1s/, "1s"],
    ])
      if (rx.test(s) && !/氦|多电子|slater|屏蔽/.test(s))
        return labRoute("waves", k);
  }
  return null;
}
export function labLink(q) {
  const r = visualFor(q);
  return r
    ? '<button class="btn small" data-action="question-lab" data-id="' +
        esc(q.id) +
        '">' +
        icon(labTabs[r.kind].icon, 15) +
        "观察模型 · " +
        esc(names[r.kind][r.preset]) +
        "</button>"
    : "";
}
export function labPage(route, back) {
  const t = labTabs[route.kind];
  return (
    '<header class="pagehead"><div><h1>结构可视化</h1><p>把纸面上的对称操作、波函数和电子排布变成可以检验的模型。</p></div>' +
    (back
      ? '<button class="btn" data-action="lab-back">' +
        icon("repeat", 16) +
        "返回题目</button>"
      : "") +
    '</header><div class="lab-tabs" role="group" aria-label="选择实验">' +
    Object.entries(labTabs)
      .map(
        ([k, v]) =>
          '<button type="button" data-action="lab-tab" data-kind="' +
          k +
          '" aria-pressed="' +
          (k === route.kind) +
          '">' +
          icon(v.icon, 18) +
          v.name +
          "</button>",
      )
      .join("") +
    '</div><section class="box lab-work"><div class="lab-title"><div><h2>' +
    t.name +
    "</h2><p>" +
    t.desc +
    '</p></div><button class="btn small" data-action="ai-lab">' +
    icon("spark", 15) +
    '请 AI 解释模型</button></div><div id="lab-stage"></div><div class="lab-sources">参考资料　<a href="' +
    t.source[1] +
    '" target="_blank" rel="noreferrer">' +
    t.source[0] +
    "</a>" +
    (t.extra
      ? ' · <a href="' +
        t.extra[1] +
        '" target="_blank" rel="noreferrer">' +
        t.extra[0] +
        "</a>"
      : "") +
    "</div></section>"
  );
}
function typesetPanels(host) {
  const selector =
    ".elab-summary p,.geom-result,.geom-summary,.wave-formula,.wave-properties output";
  const render = () => {
    for (const el of host.querySelectorAll(selector)) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement.closest("[data-lab-typeset],svg,option"))
          continue;
        if (/[A-Za-zα-ωΑ-Ωℏ√∞]/u.test(node.data)) nodes.push(node);
      }
      for (const node of nodes) {
        const html = rich(node.data);
        if (!html.includes('class="typeset-')) continue;
        const span = document.createElement("span");
        span.dataset.labTypeset = node.data;
        span.innerHTML = html;
        node.replaceWith(span);
      }
    }
  };
  render();
  const watcher = new MutationObserver((records) => {
    if (
      records.some(
        (r) =>
          r.target.nodeType === 1 &&
          !r.target.closest("[data-lab-typeset]") &&
          [...r.addedNodes].some((n) => !n.dataset?.labTypeset),
      )
    )
      render();
  });
  watcher.observe(host, { subtree: true, childList: true });
  return () => watcher.disconnect();
}
export function mountLab(host, route, onPreset) {
  const { kind, preset } = route;
  if (kind === "waves") {
    const clean = mountWaves(host, { preset, onPreset }),
      stop = typesetPanels(host);
    return () => {
      stop();
      clean();
    };
  }
  const clean = (
    kind === "molecule" || kind === "crystal" ? mountGeometry : mountElectronic
  )(host, route);
  const pick = (e) => {
    const geom = host.querySelector(".geom-select");
    if (geom === e.target) onPreset(geom.value);
    const choice = e.target.closest?.("[data-gr=system],[data-gr=config]");
    if (choice)
      onPreset(
        kind === "terms" ? "p" + choice.dataset.val : choice.dataset.val,
      );
  };
  const stop = typesetPanels(host);
  host.addEventListener("change", pick);
  host.addEventListener("click", pick, true);
  return () => {
    stop();
    host.removeEventListener("change", pick);
    host.removeEventListener("click", pick, true);
    clean();
  };
}
export function labObservation(route, host) {
  const selected = [...host.querySelectorAll("select")]
    .map((s) => s.selectedOptions[0]?.textContent)
    .filter(Boolean);
  const pressed = [...host.querySelectorAll('button[aria-pressed="true"]')].map(
    (b) => b.getAttribute("aria-label") || b.textContent,
  );
  const visible = [
    ...host.querySelectorAll(
      ".geom-result,.geom-summary,.elab-summary,.wave-properties output",
    ),
  ]
    .map((e) => {
      const copy = e.cloneNode(true);
      for (const span of copy.querySelectorAll("[data-lab-typeset]"))
        span.replaceWith(span.dataset.labTypeset);
      return copy.textContent.trim();
    })
    .filter(Boolean);
  return [
    labTabs[route.kind].name + " · " + names[route.kind][route.preset],
    ...selected,
    ...pressed,
    ...visible,
  ]
    .join("\n")
    .slice(0, 1600);
}
