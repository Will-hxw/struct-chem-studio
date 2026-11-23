import { esc } from "./ui.mjs";
import { scientificParts } from "./scientific.mjs";
let renderer, loading;
class StudyNotation extends HTMLElement {
  async connectedCallback() {
    if (!document.getElementById("workbench-math-css")) {
      const css = document.createElement("link");
      css.id = "workbench-math-css";
      css.rel = "stylesheet";
      css.href = "/vendor/katex/katex.min.css";
      document.head.append(css);
    }
    if (!loading)
      loading = import("./notation.mjs")
        .then((module) => (renderer = module))
        .catch((error) => {
          loading = null;
          throw error;
        });
    try {
      await loading;
      if (!this.isConnected) return;
      const { method, source, flag } = this.dataset;
      this.innerHTML = renderer[method](source, flag === "1");
    } catch {
      this.textContent = this.dataset.source;
    }
  }
}
if (!customElements.get("sc-notation"))
  customElements.define("sc-notation", StudyNotation);
function render(method, value, flag) {
  if (renderer) return renderer[method](value, flag);
  return (
    '<sc-notation data-method="' +
    method +
    '" data-flag="' +
    (flag ? "1" : "0") +
    '" data-source="' +
    esc(value) +
    '"></sc-notation>'
  );
}
export const formula = (value, display = false) =>
  render("formula", value, display);
export const markdown = (value, infer = false) =>
  render("markdown", value, infer);
export function rich(value) {
  if (renderer) return renderer.rich(value);
  return scientificParts(String(value ?? ""))
    .map(({ kind, value: text }) =>
      kind === "text"
        ? esc(text)
        : kind === "strong"
          ? "<strong>" + rich(text) + "</strong>"
          : formula(text, kind === "display"),
    )
    .join("");
}

export function questionStem(stem, heading = "h2", className = "") {
  return stem.includes("\n")
    ? '<div class="question-stem ' + className + '">' + markdown(stem, true) + "</div>"
    : "<" + heading + ' class="' + className + '">' + rich(stem) + "</" + heading + ">";
}
