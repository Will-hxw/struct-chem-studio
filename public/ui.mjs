const paths = {
  home: '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  book: '<path d="M3 4.5q5-2 9 1.2 4-3.2 9-1.2v14q-5-2-9 1-4-3-9-1zM12 6v14"/>',
  stack: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  errors:
    '<path d="M6 3h11a2 2 0 0 1 2 2v16l-6-3-6 3V5a2 2 0 0 0-2-2zM10 8h6m-6 4h4"/>',
  formula: '<path d="M5 4h14v3m-3-1-6 6 6 6M6 20h13v-3"/>',
  database:
    '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 9v11m3-7h5m-5 3h4"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="M7 4.5 19 12 7 19.5z" fill="currentColor" stroke-linejoin="round"/>',
  spark:
    '<path d="m13 2 1.8 5.2L20 9l-5.2 1.8L13 16l-1.8-5.2L6 9l5.2-1.8zM5 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  flag: '<path d="M5 21V4q5-3 9 0 3 2 6-1v11q-3 3-7 0-4-3-8 0"/>',
  chart: '<path d="M4 20h16M6 16v-5m5 5V5m5 11V9"/>',
  target:
    '<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="m11 13 9-10m-5 1 4 1 1 3"/>',
  star: '<path d="m12 2.5 3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1z"/>',
  check: '<path d="m4 12 5 5 11-11"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/>',
  flame:
    '<path d="M13 2c1 5-4 6-3 10 2-1 3-2 4-5 2 3 5 5 5 8a7 7 0 1 1-14 0c0-5 5-7 8-13z"/>',
  pen: '<path d="m4 16-1 5 5-1L20 8l-4-4zM14 6l4 4"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',
  search: '<circle cx="10" cy="10" r="6.8"/><path d="m15.5 15.5 5 5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',
  bolt: '<path d="m14 2-10 12h7l-1 8 10-13h-7z"/>',
  atom: '<ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  wave: '<path d="M2 13c3 0 3-8 6-8s3 14 6 14 3-9 8-9M2 21h20"/>',
  orbit:
    '<path d="M3 12h18m-9-10v20" opacity=".5"/><ellipse cx="8" cy="12" rx="4" ry="3" transform="rotate(-35 8 12)"/><ellipse cx="16" cy="12" rx="4" ry="3" transform="rotate(-35 16 12)"/>',
  molecule:
    '<circle cx="6" cy="15" r="3.3"/><circle cx="17" cy="8" r="4.5"/><path d="m8.5 12.6 4.4-3.1m-3 5.1 4.3-2.8"/>',
  symmetry: '<path d="m12 2 9 17H3zM12 2v20M3 19l9-6 9 6"/>',
  hex: '<path d="m12 2 9 5v10l-9 5-9-5V7z"/><circle cx="12" cy="12" r="5"/>',
  spectrum: '<path d="M3 19h18M5 16v-5m3 5V4m4 12V8m3 8V2m4 14v-6"/>',
  tag: '<path d="M3 3h9l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1"/>',
  repeat:
    '<path d="M4 9a8 8 0 0 1 14-3l2 2M20 3v5h-5M20 15a8 8 0 0 1-14 3l-2-2M4 21v-5h5"/>',
  note: '<path d="M5 3h10l5 5v13H5zM14 3v6h6M8 13h9m-9 4h7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8" r="1.5"/><path d="m3 17 5-5 3 3 4-5 6 7"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  copy: '<path d="M8 8h12v13H8zM4 17V3h12"/>',
  lab: '<path d="M9 3h6m-5 0v7L4 20q-1 1 2 1h12q3 0 2-2l-6-9V3M7 15h10"/>',
};
export function icon(name, size = 19) {
  return (
    '<svg aria-hidden="true" class="ico" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
    (paths[name] || paths.book) +
    "</svg>"
  );
}
export function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export const chapters = [
  {
    id: 1,
    name: "量子化学基础",
    short: "量子化学",
    label: "CHAPTER 01",
    icon: "wave",
    color: "teal",
    desc: "波粒二象性、算符与箱中粒子",
  },
  {
    id: 2,
    name: "原子结构与波函数",
    short: "原子结构",
    label: "CHAPTER 02",
    icon: "atom",
    color: "lavender",
    desc: "量子数、氢原子轨道与节点",
  },
  {
    id: 3,
    name: "双原子分子结构",
    short: "双原子分子",
    label: "CHAPTER 03",
    icon: "molecule",
    color: "blue",
    desc: "成键与反键、键级和分子磁性",
  },
  {
    id: 4,
    name: "对称性与群论",
    short: "对称性",
    label: "CHAPTER 04",
    icon: "symmetry",
    color: "amber",
    desc: "对称元素、对称操作与分子点群",
  },
  {
    id: 5,
    name: "分子轨道与离域能",
    short: "分子轨道",
    label: "CHAPTER 05",
    icon: "hex",
    color: "rose",
    desc: "共轭体系、休克尔近似与离域能",
  },
  {
    id: 6,
    name: "微观状态与光谱项",
    short: "光谱项",
    label: "专题训练",
    icon: "spectrum",
    color: "violet",
    desc: "微观状态、项符号与洪特规则",
  },
  {
    id: 7,
    name: "晶体结构",
    short: "晶体结构",
    label: "试卷专题",
    icon: "stack",
    color: "teal",
    desc: "晶胞、密堆积与晶体密度",
  },
  {
    id: 8,
    name: "配合物结构",
    short: "配合物",
    label: "试卷专题",
    icon: "symmetry",
    color: "blue",
    desc: "配位几何、晶体场与磁性",
  },
];
export const chapter = (id) =>
  chapters.find((c) => c.id === +id) || chapters[0];
export const types = [
  "单选题",
  "多选题",
  "判断题",
  "填空题",
  "计算题",
  "简答题",
  "推导题",
  "作图题",
];
export const difficulty = ["", "基础", "进阶", "综合"];
export const formOf = (q) =>
  q.options?.length
    ? "choice"
    : q.type === "计算题" && Number.isFinite(q.value)
      ? "number"
      : q.type === "填空题" && q.accepted?.length
        ? "blank"
        : "written";
export const causes = [
  "概念混淆",
  "公式或条件用错",
  "推导缺步",
  "读图与构型",
  "符号或单位",
  "计算失误",
  "审题遗漏",
  "没找到思路",
];
export const pages = {
  home: "学习总览",
  chapters: "章节练习",
  mistakes: "错题与收藏",
  guide: "知识速查",
  bank: "题库管理",
  quiz: "练习室",
  result: "练习结果",
  types: "题型突破",
  report: "学情分析",
  lab: "结构可视化",
  tutor: "AI 答疑",
  plan: "下一轮题单",
  exam: "模拟考试",
};
export const letters = "ABCDEFGHIJ";
export const tag = (s, cls = "") =>
  '<span class="tag ' + cls + '">' + esc(s) + "</span>";
export const safeImage = (s) =>
  typeof s === "string" &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) &&
  s.length < 950000;

export const figureName = (name) =>
  typeof name === "string" && /^[a-z0-9-]{1,60}$/.test(name);

export function questionImages(q, placement = "stem") {
  const uploaded = placement === "stem" && safeImage(q.image)
    ? '<img class="questionimg" alt="题图" src="' + q.image + '">'
    : "";
  return uploaded + (q.figures || [])
    .filter((f) => f.placement === placement && figureName(f.name))
    .map((f) =>
      '<img class="questionimg" loading="lazy" src="/api/figure/' + f.name +
      '" alt="' + esc(f.label) + '">',
    )
    .join("");
}
