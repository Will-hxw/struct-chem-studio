import katex from "./vendor/katex/katex.mjs";
import "./vendor/katex/mhchem.mjs";
import MarkdownIt from "./vendor/markdown-it/markdown-it.mjs";
import { scientificParts } from "./scientific.mjs";
import { esc } from "./ui.mjs";

const cache = new Map();
function unitProducts(tex) {
  return tex.replace(/\\text\{([^{}]*)\}/g, (match, text) => {
    const units = text.split(/\s*(?:[·⋅∙•]|\\(?:cdot|bullet)(?![A-Za-z]))\s*/u);
    if (units.length < 2 || !units.every((unit) => /^[A-Za-z]+$/.test(unit)))
      return match;
    return units.map((unit) => "\\mathrm{" + unit + "}").join("\\cdot ");
  });
}

export function formula(tex, display = false) {
  const key = (display ? "D" : "I") + tex;
  if (cache.has(key)) return cache.get(key);
  let html;
  try {
    if (tex.length > 8000) throw Error();
    html =
      '<span class="typeset-' +
      (display ? "display" : "inline") +
      '">' +
      katex.renderToString(unitProducts(tex), {
        displayMode: display,
        throwOnError: true,
        trust: false,
        strict: "ignore",
        output: "htmlAndMathml",
        maxExpand: 500,
        maxSize: 15,
      }) +
      "</span>";
  } catch {
    html = '<code class="math-source">' + esc(tex) + "</code>";
  }
  if (cache.size >= 750) cache.delete(cache.keys().next().value);
  cache.set(key, html);
  return html;
}
export function rich(value) {
  return scientificParts(String(value ?? ""))
    .map(({ kind, value: v }) =>
      kind === "text"
        ? esc(v)
        : kind === "strong"
          ? "<strong>" + rich(v) + "</strong>"
          : formula(v, kind === "display"),
    )
    .join("");
}
const md = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: true,
  typographer: false,
});
md.disable("image");
md.renderer.rules.table_open = () =>
  '<div class="md-table-scroll" role="region" aria-label="表格" tabindex="0"><table>';
md.renderer.rules.table_close = () => "</table></div>";
md.renderer.rules.link_open = (tokens, i, options, env, renderer) => {
  tokens[i].attrSet("target", "_blank");
  tokens[i].attrSet("rel", "noopener noreferrer");
  return renderer.renderToken(tokens, i, options);
};
md.inline.ruler.before("escape", "course_math", (state, silent) => {
  if (state.src[state.pos] !== "@") return false;
  const match = state.src
    .slice(state.pos, state.posMax)
    .match(/^@\uE000(\d+)\uE001@/);
  if (!match || !state.env.equations?.[+match[1]]) return false;
  if (!silent)
    state.push("course_math", "", 0).meta = state.env.equations[+match[1]];
  state.pos += match[0].length;
  return true;
});
md.renderer.rules.course_math = (tokens, i) =>
  formula(tokens[i].meta.tex, tokens[i].meta.display);
md.renderer.rules.text = (tokens, i, opts, env) =>
  env.infer ? rich(tokens[i].content) : esc(tokens[i].content);

// Protect math before Markdown splits table cells or interprets TeX punctuation.
// Code spans and fenced code retain their literal source.
const chunks =
  /(^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\2[`~]*[ \t]*$|(?![\s\S]))|(?<!`)(`+)(?!`)[^\n]*?\3(?!`)|\\[$]|(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$(?![\s$])(?:\\.|[^$\n])+?(?<!\\)\$)/gm;
export function markdown(value, infer = false) {
  const equations = [];
  const source = String(value ?? "")
    .replace(/[\uE000\uE001]/g, "")
    .replace(chunks, (raw) => {
      if (/^\s*(?:`|~{3})/.test(raw) || raw === "\\$") return raw;
      const display = raw.startsWith("$$") || raw.startsWith("\\[");
      const edge = raw.startsWith("$") && !display ? 1 : 2;
      equations.push({ tex: raw.slice(edge, -edge), display });
      return "@\uE000" + (equations.length - 1) + "\uE001@";
    });
  return md.render(source, { equations, infer });
}
