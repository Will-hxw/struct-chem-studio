const atoms = {
  "1s": {
    label: "氢原子 1s",
    f: (r) => Math.exp(-r),
    formula: "ψ ∝ e⁻ʳ",
    radial: 0,
    angular: 0,
    range: 5,
    note: "沿任意方向穿过原子核均为同一相位。",
  },
  "2s": {
    label: "氢原子 2s",
    f: (r) => (2 - r) * Math.exp(-r / 2),
    formula: "ψ ∝ (2 − r)e⁻ʳᐟ²",
    radial: 1,
    angular: 0,
    range: 9,
    note: "以原子核为心、半径 2a₀ 的球面是径向节点。在截面上看到的是一个圆。",
  },
  "2pz": {
    label: "氢原子 2p_z",
    f: (r, z) => z * Math.exp(-r / 2),
    formula: "ψ ∝ z e⁻ʳᐟ²",
    radial: 0,
    angular: 1,
    range: 9,
    note: "整个 xy 平面上 ψ＝0。穿过该平面时波函数变号。",
  },
  "3dz2": {
    label: "氢原子 3d_z²",
    f: (r, z) => (3 * z * z - r * r) * Math.exp(-r / 3),
    formula: "ψ ∝ (3z² − r²)e⁻ʳᐟ³",
    radial: 0,
    angular: 2,
    range: 15,
    note: "3z²＝r² 给出两个圆锥形角节点，在 xz 截面上表现为交叉的直线。",
  },
};
export const waveNames = Object.fromEntries([
  ["box", "一维无限深势箱"],
  ...Object.entries(atoms).map(([key, v]) => [key, v.label]),
]);
export function mountWaves(host, { preset = "2pz", onPreset = () => {} } = {}) {
  let key = Object.hasOwn(waveNames, preset) ? preset : "2pz",
    density = false,
    n = 2,
    pos = 0.25;
  const root = document.createElement("section");
  root.className = "wave-lab";
  host.append(root);
  root.innerHTML =
    '<label class="wave-select">选择模型 <select>' +
    Object.entries(waveNames)
      .map(([k, l]) => '<option value="' + k + '">' + l + "</option>")
      .join("") +
    '</select></label><div class="wave-grid"><figure><canvas width="500" height="360" role="img"></canvas><figcaption></figcaption></figure><div class="wave-properties"></div></div>';
  const sel = root.querySelector("select"),
    can = root.querySelector("canvas"),
    cap = root.querySelector("figcaption"),
    props = root.querySelector(".wave-properties"),
    ctx = can.getContext("2d");
  const handles = new AbortController();
  const line = (a, b, color, dash = []) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.lineTo(...b);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const text = (s, x, y) => {
    ctx.fillStyle = "#31584b";
    ctx.font = '13px "Times New Roman","Microsoft YaHei","PingFang SC",sans-serif';
    ctx.fillText(s, x, y);
  };
  function boxDraw() {
    ctx.fillStyle = "#f4f8f5";
    ctx.fillRect(0, 0, 500, 360);
    const top = density ? 67 : 55,
      bottom = density ? 287 : 290,
      zero = density ? bottom : 172;
    const xy = (x, y) => [44 + x * 414, zero - y * (density ? 110 : 78)];
    for (let i = 0; i <= 4; i++) {
      const x = 44 + i * 103.5;
      line([x, top], [x, bottom], "#d1e0d6", [3, 5]);
      text(String(i / 4), x - 8, 313);
    }
    line([44, zero], [458, zero], "#778f80");
    line([44, top], [44, bottom], "#526f60");
    line([458, top], [458, bottom], "#526f60");
    const curve = (x) =>
      density
        ? 2 * Math.sin(n * Math.PI * x) ** 2
        : Math.SQRT2 * Math.sin(n * Math.PI * x);
    ctx.strokeStyle = "#17684f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 500; i++) {
      const p = xy(i / 500, curve(i / 500));
      if (!i) ctx.moveTo(...p);
      else ctx.lineTo(...p);
    }
    ctx.stroke();
    const [x, y] = xy(pos, curve(pos));
    line([x, top], [x, bottom], "#b3793d", [4, 3]);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#b36b2d";
    ctx.fill();
    text(density ? "L |ψ|²" : "√L ψ", 14, 29);
    text("x/L", 460, 317);
    text("0", 22, zero + 4);
    cap.textContent = "橙色标记是读数位置。横轴使用相对位置 x/L。";
    can.setAttribute(
      "aria-label",
      "一维势箱第 " +
        n +
        " 态" +
        (density ? "概率密度曲线" : "波函数曲线") +
        "，内部有 " +
        (n - 1) +
        " 个节点。",
    );
  }
  function atomDraw() {
    const m = atoms[key],
      side = 310,
      offX = 95,
      offY = 18;
    ctx.fillStyle = "#f5f8f5";
    ctx.fillRect(0, 0, 500, 360);
    const data = ctx.createImageData(side, side),
      vals = new Float32Array(side * side);
    let max = 0;
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        const a = ((x - (side - 1) / 2) / (side / 2)) * m.range,
          z = (((side - 1) / 2 - y) / (side / 2)) * m.range;
        const v = m.f(Math.hypot(a, z), z);
        vals[y * side + x] = v;
        if (Math.abs(v) > max) max = Math.abs(v);
      }
    vals.forEach((v, i) => {
      const target = density || v > 0 ? [21, 112, 83] : [183, 99, 49];
      const w = density ? (v / max) ** 2 : Math.abs(v / max);
      for (let j = 0; j < 3; j++)
        data.data[4 * i + j] = Math.round(249 + (target[j] - 249) * w);
      data.data[4 * i + 3] = 255;
    });
    ctx.putImageData(data, offX, offY);
    const cx = offX + side / 2,
      cy = offY + side / 2;
    line([offX, cy], [offX + side, cy], "#668574", [2, 6]);
    line([cx, offY], [cx, offY + side], "#668574", [2, 6]);
    text("x", offX + side + 9, cy + 5);
    text("z", cx + 7, offY + 6);
    text("−" + m.range + "a₀", offX, 348);
    text(m.range + "a₀", offX + side - 30, 348);
    cap.textContent = density
      ? "深绿色表示相对概率密度大，白色表示趋近于零。"
      : "绿色与赭色表示相反相位；颜色越深，波函数绝对值越大。";
    can.setAttribute(
      "aria-label",
      m.label +
        " 的 xz 截面，" +
        m.radial +
        " 个径向节点和 " +
        m.angular +
        " 个角节点。",
    );
  }
  function draw() {
    if (key === "box") boxDraw();
    else atomDraw();
  }
  function readout() {
    if (key !== "box") return;
    const s = Math.SQRT2 * Math.sin(n * Math.PI * pos);
    root.querySelector("output").textContent =
      "x/L = " +
      pos.toFixed(2) +
      "　√L ψ = " +
      (Math.abs(s) < 0.0005 ? 0 : s).toFixed(3) +
      "　L |ψ|² = " +
      (s * s).toFixed(3);
  }
  function repaint() {
    sel.value = key;
    const box = key === "box",
      m = atoms[key];
    props.innerHTML =
      '<div class="wave-btns"><button type="button" data-wave="phase" aria-pressed="' +
      !density +
      '">波函数 ψ</button><button type="button" data-wave="density" aria-pressed="' +
      density +
      '">概率密度 |ψ|²</button></div>' +
      (box
        ? '<h3>一维无限深势箱</h3><p class="wave-formula">ψₙ = √(2/L) sin(nπx/L)</p><label>量子数 n <select class="wave-n">' +
          [1, 2, 3, 4, 5, 6]
            .map(
              (i) =>
                "<option " +
                (i === n ? "selected" : "") +
                ">" +
                i +
                "</option>",
            )
            .join("") +
          '</select></label><label>读数位置 x/L <input class="wave-x" type="range" min="0" max="1" step=".01" value="' +
          pos +
          '"></label><output></output><p>箱内有 <b>' +
          (n - 1) +
          "</b> 个节点。箱壁 x = 0、L 处波函数也为零。能量 Eₙ/E₁ = " +
          n * n +
          "。</p>"
        : "<h3>" +
          m.label +
          '</h3><p class="wave-formula">' +
          m.formula +
          "</p><p>xz 截面，取 y = 0。式中坐标以玻尔半径 a₀ 为单位，图中强度按本图峰值归一。</p><p><b>径向节点 " +
          m.radial +
          " 个 · 角节点 " +
          m.angular +
          " 个</b></p><p>" +
          m.note +
          "</p>");
    readout();
    draw();
  }
  sel.onchange = () => {
    key = sel.value;
    repaint();
    onPreset(key);
  };
  root.addEventListener(
    "click",
    (e) => {
      const mode = e.target.closest("[data-wave]")?.dataset.wave;
      if (mode) {
        density = mode === "density";
        repaint();
        root
          .querySelector('[data-wave="' + mode + '"]')
          ?.focus({ preventScroll: true });
      }
    },
    { signal: handles.signal },
  );
  root.addEventListener(
    "input",
    (e) => {
      if (e.target.matches(".wave-x")) {
        pos = Number(e.target.value);
        readout();
        draw();
      }
    },
    { signal: handles.signal },
  );
  root.addEventListener(
    "change",
    (e) => {
      if (e.target.matches(".wave-n")) {
        n = Number(e.target.value);
        repaint();
        root.querySelector(".wave-n").focus({ preventScroll: true });
      }
    },
    { signal: handles.signal },
  );
  repaint();
  return () => {
    handles.abort();
    root.remove();
  };
}
