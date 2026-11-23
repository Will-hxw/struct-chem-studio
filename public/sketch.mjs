export function sketchRender(saved = "", locked = false) {
  return (
    '<div class="sketch-wrap"><div class="formhint">作图区 · 可用鼠标、手指或触控笔绘图</div><canvas id="sketch" width="900" height="380" aria-label="作图答案画布"></canvas>' +
    (!locked
      ? '<div class="tools"><button class="btn small" type="button" id="undo-stroke">撤销一笔</button></div>'
      : "") +
    "</div>"
  );
}
export function attachSketch(paths = [], locked, onSave) {
  const c = document.getElementById("sketch");
  if (!c) return;
  const cx = c.getContext("2d");
  let current = null;
  const redraw = () => {
    cx.clearRect(0, 0, c.width, c.height);
    cx.strokeStyle = "#2d4f3b";
    cx.lineWidth = 2.4;
    cx.lineCap = "round";
    cx.lineJoin = "round";
    for (const line of paths) {
      cx.beginPath();
      line.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y)));
      cx.stroke();
    }
  };
  redraw();
  if (locked) return;
  const point = (e) => {
    const b = c.getBoundingClientRect();
    return [
      Math.round(((e.clientX - b.left) * c.width) / b.width),
      Math.round(((e.clientY - b.top) * c.height) / b.height),
    ];
  };
  c.onpointerdown = (e) => {
    if (paths.length >= 400) return;
    c.setPointerCapture(e.pointerId);
    current = [point(e)];
    paths.push(current);
  };
  c.onpointermove = (e) => {
    if (current && current.length < 600) {
      current.push(point(e));
      redraw();
    }
  };
  const end = () => {
    if (current) {
      current = null;
      onSave(paths);
      redraw();
    }
  };
  c.onpointerup = end;
  c.onpointercancel = end;
  document.getElementById("undo-stroke").onclick = () => {
    paths.pop();
    onSave(paths);
    redraw();
  };
}
