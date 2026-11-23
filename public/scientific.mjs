// Plain text remains a string all the way to the view. Only the two exported
// functions create math spans. The domain vocabulary below is deliberately closed.
const add = (parts, kind, value) => {
  if (!value) return;
  const last = parts[parts.length - 1];
  if (last && last.kind === kind && (kind === "text" || kind === "strong")) last.value += value;
  else parts.push({ kind, value });
};

function escaped(source, position) {
  let count = 0;
  while (position > 0 && source[--position] === "\\") count++;
  return count % 2 === 1;
}

const delimiters = [
  ["$$", "$$", "display"], ["\\[", "\\]", "display"],
  ["\\(", "\\)", "math"], ["$", "$", "math"], ["**", "**", "strong"],
];

function authored(source, plain, parts, allowBold = true) {
  const markers = /\$\$?|\\[[(]|\*\*/g;
  let start = 0, match;
  while ((match = markers.exec(source))) {
    const at = match.index;
    if (escaped(source, at)) { markers.lastIndex = at+1; continue; }
    const [open, close, kind] = delimiters.find(([token]) => token === match[0]);
    if (kind === "strong" && !allowBold) continue;
    const inner = at + open.length;
    let end = source.indexOf(close, inner);
    while (end !== -1 && escaped(source, end)) {
      end = source.indexOf(close, end + 1);
    }
    if (end <= inner) continue;
    const value = source.slice(inner, end);
    if (open === "$" && (value.includes("\n") ||
        (/^\d/.test(value) && /\s$/.test(value) && /^\d/.test(source.slice(end+1))))) continue;
    add(parts, plain, source.slice(start, at));
    if (kind === "strong") authored(value, "strong", parts, false);
    else add(parts, kind, value);
    start = end + close.length;
    markers.lastIndex = start;
  }
  add(parts, plain, source.slice(start));
}

export function authoredParts(text) {
  const parts = [];
  authored(String(text ?? ""), "text", parts);
  return parts;
}

const tex = String.raw;
const subChars = "₀₁₂₃₄₅₆₇₈₉₊₋ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵧᵦ";
const supChars = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁽⁾ᐟᴸᴱʳᵇˢ";
const scripts = Object.fromEntries([
  ...[...subChars].map((ch, i) => [ch, [..."0123456789+-aehijklmnoprstuvxy"][i] ?? tex`\beta`]),
  ...[...supChars].map((ch, i) => [ch, [..."0123456789+-()/LErbs"][i]]),
]);
const decode = (s) => [...s].map((ch) => scripts[ch] ?? ch).join("");
const subs = new RegExp("^[" + subChars + "]+");
const sups = new RegExp("^[" + supChars + "]+");
const greek = {
  α:"alpha", β:"beta", γ:"gamma", δ:"delta", ε:"varepsilon", η:"eta",
  θ:"theta", λ:"lambda", μ:"mu", ν:"nu", π:"pi", ρ:"rho", σ:"sigma",
  τ:"tau", φ:"phi", χ:"chi", ψ:"psi", ω:"omega", Δ:"Delta", Γ:"Gamma",
  Π:"Pi", Φ:"Phi", Σ:"Sigma", ℓ:"ell", ℏ:"hbar", "∂":"partial", "∞":"infty",
  "∫":"int", "∑":"sum",
};
const operators = {
  "=":"=", "＝":"=", "+":"+", "＋":"+", "−":"-", "－":"-", "-":"-", "±":tex`\pm`,
  "<":"<", ">":">", "≤":tex`\le`, "≥":tex`\ge`, "≈":tex`\approx`, "≠":tex`\ne`,
  "≫":tex`\gg`, "∝":tex`\propto`, "→":tex`\to`, "↔":tex`\leftrightarrow`,
  "∶":tex`\mathbin{:}`, "×":tex`\times`, "·":tex`\cdot`, "÷":tex`\div`, ",":",",
};
const atoms = new Map();
function remember(raw, value, role = "atom") { atoms.set(raw, { value, role }); }

for (const [raw, value] of Object.entries({
  "²ˢ⁺¹Lⱼ": tex`{}^{2S+1}L_{J}`, "Γ₃N":tex`\Gamma_{3N}`,
  "ψ±":tex`\psi_{\pm}`, "N±":tex`N_{\pm}`, "μB":tex`\mu_{\mathrm B}`,
  "μₛₒ":tex`\mu_{\mathrm{so}}`, "Nₐ":tex`N_{\mathrm A}`, "∫ᵥ":tex`\int_{V}`,
  "mℓ":tex`m_{\ell}`, "mℓ₁":tex`m_{\ell_1}`, "mℓ₂":tex`m_{\ell_2}`, "mₗ":tex`m_{\ell}`, "Mₗ":tex`M_{L}`, "Mₛ":tex`M_{S}`,
  "Mⱼ":tex`M_{J}`, "Eπ":tex`E_{\pi}`, "Eγ":tex`E_{\gamma}`,
  "nₜ₂g":tex`n_{t_{2\mathrm g}}`, "nₑg":tex`n_{e_{\mathrm g}}`,
  "ψ₁s":tex`\psi_{1s}`, "Ĥ":tex`\hat H`, "∂ₓ":tex`\partial_{x}`,
  "g/u":tex`\mathrm{g}/\mathrm{u}`, "Σ⁺/Σ⁻":tex`\Sigma^{+}/\Sigma^{-}`,
  "(nπ−nπ*)/2":tex`\frac{n_{\pi}-n_{\pi^{*}}}{2}`,
  "C₁/C₂":tex`\mathrm C_{1}/\mathrm C_{2}`, "C₂/C₃":tex`\mathrm C_{2}/\mathrm C_{3}`,
  "C₃/C₄":tex`\mathrm C_{3}/\mathrm C_{4}`, "d_xy/d_xy":tex`d_{xy}/d_{xy}`,
  "p_x/d_xz":tex`p_{x}/d_{xz}`, "p_x/d_yz":tex`p_{x}/d_{yz}`,
  "∂/∂x":tex`\frac{\partial}{\partial x}`, "1s-LCAO":tex`1s\text{-}\mathrm{LCAO}`,
  "H(1s)":tex`\mathrm H(1s)`, "d–d":tex`d\text{–}d`, "SN2":tex`\mathrm{S}_{\mathrm N}2`,
  "E1":tex`\mathrm{E}1`,
  "c₂L":tex`c_{2\mathrm L}`, "c₃L":tex`c_{3\mathrm L}`,
  "c₂H":tex`c_{2\mathrm H}`, "c₃H":tex`c_{3\mathrm H}`,
  "ΔE稳":tex`\Delta E_{\text{稳}}`, "E局域":tex`E_{\text{局域}}`, "E离域":tex`E_{\text{离域}}`,
  "E成":tex`E_{\text{成}}`, "E反":tex`E_{\text{反}}`,
  "N成键":tex`N_{\text{成键}}`, "N反键":tex`N_{\text{反键}}`,
  "E低自旋":tex`E_{\text{低自旋}}`, "E高自旋":tex`E_{\text{高自旋}}`,
  "ρ成键":tex`\rho_{\text{成键}}`, "ρ混合":tex`\rho_{\text{混合}}`,
  "P激发":tex`P_{\text{激发}}`, "P基态":tex`P_{\text{基态}}`,
  "Eπ(正方形)":tex`E_{\pi}(\text{正方形})`, "Eπ(长方形)":tex`E_{\pi}(\text{长方形})`,
  "cCcO":tex`c_{\mathrm C}c_{\mathrm O}`, "cO":tex`c_{\mathrm O}`, "cC":tex`c_{\mathrm C}`,
  "qO":tex`q_{\mathrm O}`, "qC":tex`q_{\mathrm C}`,
})) remember(raw, value);
for (const [base, tails] of [["H", ["AA","BB","AB","BA","CC","CO","OO"]], ["S", ["AA","BB","AB","BA"]]]) {
  for (const t of tails) remember(base+t, base+"_{\\mathrm{"+t+"}}");
}
for (const t of ["φA","φB","φC","φO","χA","χB"]) {
  remember(t, "\\"+greek[t[0]]+"_{\\mathrm "+t[1]+"}");
}
for (const t of ["Lz","L_z","ms","M_L","M_S","μ_z","μx","μy","μz","αyy","αyz","αₓy","αₓz"]) {
  const [base, ...tail] = t.replace("_","").replace("ₓ","x");
  remember(t, (greek[base] ? "\\"+greek[base] : base)+"_{"+tail.join("")+"}");
}
for (const [raw, label] of [["π_x","x"],["πu","u"],["σg","g"],["σh","h"]]) {
  remember(raw, "\\"+greek[raw[0]]+"_{"+(label === "x" ? "x" : "\\mathrm "+label)+"}");
}
for (const t of ["ₕ","ᵥ","ₛ"]) remember("σ"+t, "\\sigma_{\\mathrm "+decode(t)+"}");
for (const t of ["dₓ²₋ᵧ²","dx²−y²","d(x²−y²)"]) remember(t, "d_{x^{2}-y^{2}}");
for (const t of ["dz²","d(z²)"]) remember(t, "d_{z^{2}}");
for (const v of ["xy","xz","yz","x","y","z"]) {
  for (const b of ["d","p"]) {
    if ((b === "d") === (v.length === 2)) {
      remember(b+"_"+v, b+"_{"+v+"}");
      if (b === "d") remember(b+v, b+"_{"+v+"}");
    }
  }
}
for (const t of ["T_d","O_h","Oₕ","Cₛ","C∞v","D∞h"]) {
  const d = t.slice(1).replace("_","").replace("∞",tex`\infty`);
  const sub = decode(d);
  remember(t, "\\mathrm{"+t[0]+"}_{"+(d.startsWith("\\infty") ? "\\infty\\mathrm{"+d.at(-1)+"}" : "\\mathrm{"+sub+"}")+"}");
}
for (const t of ["HOMO","LUMO"]) remember(t, "\\mathrm{"+t+"}", "acronym");
atoms.get("μB").quantity = true;
for (const ch of ["τ","θ","φ"]) remember("d"+ch, "\\mathrm d\\"+greek[ch], "differential");

const chemGroups = [
  "[Pt(NH₃)₂Cl₂]","[Co(NH₃)₆]","[Cr(en)₃]","[Fe(CN)₆]","[Ni(CN)₄]","[NiCl₄]","[PtCl₄]","[FeF₆]",
  "CH₂=CHCH₂Cl","CH₃CH₂Cl","H₂C=C=CH₂","CH₂=CHCl","C₃H₅","MA₄B₂","HOCl","HDO","CsCl","NaCl","CO₂","N₂O",
  "H₂O","NH₃","BF₃","CH₄","CH₂","Cl₂","H₂","O₂","N₂","F₂","B₂","O₃","NO","CO","CN","HF",
];
const elements = "H He Li B C N O F Na Cl Ar Cr Mn Fe Co Ni Cu Zn Pt".split(" ");
const isolatedElements = new Set("He Li Na Cl Ar Cr Mn Fe Co Ni Cu Zn Pt".split(" "));
function chem(raw) {
  return raw.replace(/[A-Z][a-z]?|en|[₀-₉]+|[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+|=/g, (s) => {
    if (/^[A-Za-z]/.test(s)) return "\\mathrm{"+s+"}";
    if (s === "=") return tex`\mathord{=} `;
    return (/^[₀-₉]/.test(s) ? "_{" : "^{") + decode(s) + "}";
  });
}
for (const t of chemGroups) {
  const value = chem(t);
  remember(t, value, "chemical");
  const ascii = t.replace(/[₀-₉]/g, decode);
  if (ascii !== t) remember(ascii, value, "chemical");
}
for (const t of isolatedElements) remember(t, chem(t), "chemical");
for (const t of ["Fe(II)","Fe(III)","Co(III)","Mn(II)","Ni(II)","Pt(II)","Cu(II)","Zn(II)"]) {
  remember(t, "\\mathrm{"+t+"}", "chemical");
}
for (const t of ["¹²C","¹⁶O","¹H","²H"]) {
  remember(t, "{}^{"+decode(t.slice(0,-1))+"}\\mathrm{"+t.at(-1)+"}", "chemical");
}
for (const t of ["C=C","C—C","C—H","C—O","C—Cl","Cl—Cl","Pt—Cl","B—M—B","H—O—Cl","O—C—O","N—H"]) {
  const bond = t.includes("=") ? "=" : "—";
  remember(t, t.split(bond).map(chem).join(bond === "=" ? tex`\mathord{=}` : tex`\mathord{-}`), "chemical");
}
for (const t of ["1–2–4–5–6–1","1–18","1–6"]) remember(t, t.replaceAll("–",tex`\text{–}`));
const byInitial = new Map();
for (const source of atoms.keys()) {
  if (!byInitial.has(source[0])) byInitial.set(source[0], []);
  byInitial.get(source[0]).push(source);
}
for (const choices of byInitial.values()) choices.sort((a,b) => b.length-a.length);

const shortProducts = new Set(("mL mE eU hc kL ky ikx rR Zr AB BA ZM Hc ESc tc gS dE da bc cI cX BJ Ax yy xy xz yz ds dx dr " +
  "ns np").split(/\s+/));
const unitAtom = "(?:Hartree|mol|kg|kJ|cm|pm|nm|eV|[mJsVugCL])(?:[⁺⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?";
const units = new RegExp("^"+unitAtom+"(?:[·/]"+unitAtom+")*(?![A-Za-z₀-₉])");
const quantityTag = /(?:单位(?:取|为|是|若取)?|换为|换算成)\s*$/;
const unitTeX = (s) => s.replace(/[A-Za-z]+|[⁺⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+|·/g, (x) =>
  x === "·" ? tex`\,{\cdot}\,` : /^[A-Za-z]/.test(x) ? "\\mathrm{"+x+"}" : "^{"+decode(x)+"}");
const funs = { sin:tex`\sin`, cos:tex`\cos`, exp:tex`\exp`, det:tex`\det`, tr:tex`\operatorname{tr}` };

function tokenAt(source, i) {
  const rest = source.slice(i), ch = rest[0], atom = (raw, value, role = "atom", extra = {}) =>
    ({ raw, value, role, ...extra });
  if (/[ \t\u00a0]/.test(ch)) return atom(/^[ \t\u00a0]+/.exec(rest)[0], "", "space");
  if (ch === "\n" || ch === "\r" || ch === "　") return atom(ch, ch, "text");
  if (ch === "_" && rest.startsWith("__")) return atom(/^_+/.exec(rest)[0], "", "text");
  let m;
  if (/^[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f]/.test(ch)) {
    const latin = /^[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u024f\u0300-\u036f]+/.exec(rest)[0];
    if (/[^A-Za-z]/.test(latin)) return atom(latin,latin,"text");
  }
  if ((m = /^(?:https?:\/\/|www\.)[^\s，。；：！？）】]+/.exec(rest))) return atom(m[0],m[0],"text");
  if ((m = /^`[^`\n]+`/.exec(rest))) return atom(m[0],m[0],"text");
  if ((m = /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>\n]*)?\/?>/.exec(rest))) return atom(m[0],m[0],"text");
  // C(n,k) occurs alongside ordinary C–atom labels and matrix coordinates.
  if ((m = /^C\(\s*(\d+|n|4[ℓl]\s*[+＋]\s*2)\s*,\s*(\d+|[qk])\s*\)/.exec(rest))) {
    return atom(m[0], "\\binom{"+m[1].replace(/\s/g,"").replace(/[ℓl]/,tex`\ell `)+"}{"+m[2]+"}");
  }
  // Whole symbols have priority over their components, especially signs on ions,
  // the letters in matrix subscripts, and odd parity on a half-integral term.
  for (const raw of byInitial.get(ch) ?? []) {
    if (!rest.startsWith(raw)) continue;
    const next = rest[raw.length] ?? "";
    const entry = atoms.get(raw);
    const suffix = rest.slice(raw.length);
    if ((/[a-zA-Z]$/.test(raw) && /^[A-Za-z]$/.test(next)) ||
        (entry.role === "chemical" && /^[₀-₉0-9]$/.test(next) && !/^\d+[+−-](?![A-Za-z0-9])/.test(suffix))) continue;
    if ((raw === "E成" || raw === "E反") && !/^[\s=＝+−-]|^$/.test(rest.slice(raw.length))) continue;
    if (entry.role === "chemical") {
      const charge = /^(?:\^\{?([0-9]*[+−-])\}?|(\d+[+−-])|([+−-]))(?![\w₀-₉(])/.exec(suffix);
      if (charge) return atom(raw+charge[0],entry.value+"^{"+(charge[1] ?? charge[2] ?? charge[3]).replace("−","-")+"}","chemical");
    }
    return atom(raw, entry.value, entry.role, { quantity: Boolean(entry.quantity) });
  }
  if ((m = /^([¹²³⁴⁵⁶⁷⁸⁹])([SPDFGHI])(°)?([₀-₉]+(?:\/[₀-₉]+)?)?/.exec(rest))) {
    return atom(m[0], "{}^{"+decode(m[1])+"}\\mathrm{"+m[2]+"}"+
      (m[3] ? "^{\\circ}" : "") + (m[4] ? "_{"+decode(m[4])+"}" : ""));
  }
  if ((m = /^([CDS])_?([₀-₉ₙ]+|[1-9])([hvdₕᵥ])?/.exec(rest))) {
    const suffix = m[3] ? "\\mathrm{"+decode(m[3])+"}" : "";
    return atom(m[0],"\\mathrm{"+m[1]+"}_{"+decode(m[2])+suffix+"}");
  }
  if ((m = /^(t₂g|t2g|t_2g|e_g|t₂|e⁴)/.exec(rest)) && !/^[a-z]$/.test(rest[m[0].length] ?? "")) {
    const orbital = m[1];
    return atom(orbital, orbital === "e_g" ? tex`e_{\mathrm{g}}` :
      orbital === "e⁴" ? "e^{4}" : orbital === "t₂" ? "t_{2}" : tex`t_{2\mathrm{g}}`);
  }
  if ((m = /^([πσδ])(\*)?([1-9][spdf])/.exec(rest))) {
    return atom(m[0], "\\"+greek[m[1]]+(m[2] ? "^{*}" : "")+"_{"+m[3]+"}");
  }
  if ((m = /^([πσδψφ])\*/.exec(rest))) return atom(m[0], "\\"+greek[m[1]]+"^{*}");
  if (!/√\s*$/.test(source.slice(Math.max(0,i-4),i)) && (m = /^(?:[1-9][spdf]|sp)(?=[⁰¹²³⁴⁵⁶⁷⁸⁹₊₋₀-₉ₓᵧ_αβ\s,，。、）)→（\u3400-\u9fff]|$)/.exec(rest))) {
    return atom(m[0], m[0], "orbital");
  }
  if ((m = /^([cφχ])([ₐᵦ])/.exec(rest))) return atom(m[0], (greek[ch] ? "\\"+greek[ch] : ch)+"_{"+decode(m[2])+"}");
  if (ch === "Σ" && /^Σ(?:[ᵢₙₖ|]|\s*[cnPℓ])/.test(rest)) return atom(ch,tex`\sum`);
  if (greek[ch]) return atom(ch, "\\"+greek[ch]);
  if (ch === "…" && /[,，]/.test(source[i-1] ?? "")) return atom(ch,tex`\ldots`);
  if (rest.startsWith("带心") && /[=＝]/.test(source[i-1] ?? "")) return atom("带心",tex`\text{带心}`);
  // Unit atoms can also be variables. A single ambiguous letter only becomes a
  // unit in a written quantity or directly following a unit cue.
  if ((m = units.exec(rest))) {
    const u = m[0], prior = source.slice(Math.max(0,i-24),i);
    const tail = rest.slice(u.length);
    const explicitUnit = /^(?:Hartree|mol|kg|kJ|cm|pm|nm|eV)/.test(u) || /[·/]/.test(u);
    const numeric = /(?:\d|[⁰¹²³⁴⁵⁶⁷⁸⁹])\s+$/.test(prior);
    const unitContext = quantityTag.test(prior) || (/以\s*$/.test(prior) && /^\s*(?:为单位|计|作答|表示)/.test(tail));
    if (explicitUnit || numeric || unitContext) {
      return atom(u, unitTeX(u), "unit", { quantity: true });
    }
  }
  if ((m = /^(?:sin|cos|exp|det|tr)(?![A-Za-z]{2,})/.exec(rest))) return atom(m[0],funs[m[0]],"function");
  if ((m = /^[A-Za-z]+/.exec(rest))) {
    const word = m[0];
    if (word.length === 1) {
      if (elements.includes(word) && (m = /^([+−-])(?=$|[，。、；）])/.exec(rest.slice(1)))) {
        return atom(word+m[1],chem(word)+"^{"+m[1].replace("−","-")+"}","chemical");
      }
      if (elements.includes(word) && (/^(?:[⁺⁻])/.test(rest.slice(1)) ||
          /^\s*(?:原子|元素|离子|核)/.test(rest.slice(1)))) return atom(word,chem(word),"chemical");
      return atom(word, word, "variable");
    }
    if (shortProducts.has(word)) {
      if (/^d[xrsEa]$/.test(word)) return atom(word, "\\mathrm d "+word[1],"differential");
      return atom(word,word,"product");
    }
    return atom(word, word, "text");
  }
  if ((m = /^(?:\d+\.\d+|\d+|\.\d+)/.exec(rest))) return atom(m[0],m[0],"number");
  if ((m = subs.exec(rest))) return atom(m[0],decode(m[0]),"sub");
  if ((m = sups.exec(rest))) return atom(m[0],decode(m[0]),"sup");
  if (ch === "√") return atom(ch,"","root");
  if ("([⟨".includes(ch)) return atom(ch,ch,"open");
  if (")]⟩".includes(ch)) return atom(ch,ch,"close");
  if (ch === "|") return atom(rest.startsWith("||") ? "||" : "|","","bar");
  if (ch === "/" || ch === "^" || ch === "_") return atom(ch,ch,ch);
  if (ch === "†" || ch === "′" || ch === "″" || ch === "*" || ch === "°") {
    return atom(ch, ({"†":tex`\dagger`, "′":tex`\prime`, "″":tex`\prime\prime`, "*":"*", "°":tex`\circ`})[ch],"sup");
  }
  if (ch === "!" || ch === "%" || ch === "↑" || ch === "↓") {
    const val = {"!":"!", "%":tex`\%`, "↑":tex`\uparrow`, "↓":tex`\downarrow`}[ch];
    return atom(ch,val, ch === "%" || ch === "!" ? "postfix" : "atom");
  }
  if (ch === "—" || ch === "–") return atom(ch,ch === "—" ? tex`\mathord{-}` : tex`\text{–}`,"dash");
  if (Object.hasOwn(operators,ch)) return atom(ch, operators[ch], "operator");
  return atom(ch,ch,"text");
}
const opens = { "(":")", "[":"]", "⟨":"⟩" };
const leftDelim = { "(": "(", "[": "[", "⟨":tex`\langle`, "|":tex`\lvert`, "||":tex`\lVert` };
const rightDelim = { ")":")", "]":"]", "⟩":tex`\rangle`, "|":tex`\rvert`, "||":tex`\rVert` };
const multiply = (t) => t.role === "operator" && /[×·÷]/.test(t.raw);
const isOperator = (t) => t.role === "operator" || t.role === "dash";
const isFactor = (t) => !isOperator(t) && !["sup","sub","^","_","/","root","postfix"].includes(t.role);

function serialize(nodes) {
  return nodes.map((item, i) => {
    if (!i) return item.value;
    if (item.role === "differential" || (item.quantity && item.gap && !isOperator(nodes[i-1]))) return "\\," + item.value;
    // A principal-shell label and its term are separate in a level designation.
    if (item.gap && item.value.startsWith("{}^") && nodes[i-1].role === "orbital") return "\\," + item.value;
    return " " + item.value;
  }).join("");
}

function content(nodes) {
  if (nodes.length === 1 && nodes[0].unwrap !== undefined) return nodes[0].unwrap;
  return serialize(nodes);
}

function powersAndRadicals(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const t = items[i];
    const power = t.role === "^" || t.role === "sup" ? "^" : t.role === "_" || t.role === "sub" ? "_" : "";
    if (!power) { out.push(t); continue; }
    let argument = t.value;
    if (t.role === "^" || t.role === "_") {
      const operand = items[i+1];
      if (!operand || !isFactor(operand)) { out.push({...t,value:power === "^" ? tex`\char"005E` : tex`\_ `}); continue; }
      argument = content([operand]);
      i++;
    }
    const base = out[out.length-1];
    if (!base || !isFactor(base)) { out.push({...t,value:"{}"+power+"{"+argument+"}",role:"atom"}); continue; }
    // Wrapping is necessary only for an already present script of the same kind.
    const prefix = base[power] || (base.role !== "group" && base.value.includes(power+"{")) ? "{"+base.value+"}" : base.value;
    base.value = prefix + power + "{" + argument + "}";
    base[power] = true;
    delete base.unwrap;
  }
  for (let i = out.length - 2; i >= 0; i--) {
    if (out[i].role !== "root" || !isFactor(out[i+1])) continue;
    const operand = out[i+1];
    out.splice(i,2,{...out[i], role:"radical", value:"\\sqrt{"+content([operand])+"}"});
  }
  return out.map(t => t.role === "root" ? {...t, value:tex`\surd`} : t);
}

function product(nodes) {
  const done = [];
  for (let i = 0; i < nodes.length; i++) {
    const slash = nodes[i];
    if (slash.role !== "/" || !done.length || !nodes[i+1] || !isFactor(nodes[i+1])) {
      done.push(slash);
      continue;
    }
    const denominator = [nodes[++i]];
    // A written pair of brackets fixes the denominator's right edge. For
    // unbracketed products such as πa₀³ or 2m, include the adjacent factors.
    if (denominator[0].role !== "group") {
      while (i+1 < nodes.length) {
        const next = nodes[i+1];
        if (!isFactor(next) || (next.quantity && next.gap) || next.role === "differential") break;
        denominator.push(next);
        i++;
      }
    }
    const value = "\\frac{"+content(done)+"}{"+content(denominator)+"}";
    done.splice(0,done.length,{role:"fraction",value,gap:done[0]?.gap});
  }
  return done;
}

function expression(nodes) {
  const output = [];
  let term = [];
  for (const n of powersAndRadicals(nodes)) {
    if (isOperator(n) && !multiply(n)) {
      output.push(...product(term), n);
      term = [];
    } else term.push(n);
  }
  output.push(...product(term));
  return serialize(output);
}

function groupTree(tokens) {
  const pairs = new Map(), midBars = new Set(), stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i], last = stack.at(-1);
    if (t.role === "open") stack.push({raw:t.raw,i});
    else if (t.role === "bar") {
      if (last?.raw === t.raw) { pairs.set(last.i,i); stack.pop(); }
      else if (last?.raw === "⟨") midBars.add(i);
      else stack.push({raw:t.raw,i});
    } else if (t.role === "close" && last &&
        (opens[last.raw] === t.raw || (last.raw === "|" && t.raw === "⟩"))) {
      pairs.set(last.i,i);
      stack.pop();
    }
  }
  function read(start, stop, depth) {
    const nodes = [];
    for (let i=start; i<stop; i++) {
      const t = tokens[i], close = pairs.get(i);
      if (close !== undefined && close < stop && depth < 24) {
        const children = read(i+1,close,depth+1);
        const inner = expression(children);
        const ordinary = (t.raw === "(" || t.raw === "[") && !children.some(g => g.raw === ",");
        nodes.push({...t,role:"group",value:"\\left"+leftDelim[t.raw]+" "+inner+" \\right"+rightDelim[tokens[close].raw],
          ...(ordinary ? {unwrap:inner} : {})});
        i = close;
      } else if (midBars.has(i)) nodes.push({...t,role:"operator",value:t.raw === "||" ? tex`\Vert` : tex`\vert`});
      else if (t.role === "bar" || t.role === "open" || t.role === "close") {
        nodes.push({...t,role:"literal",value:leftDelim[t.raw] ?? rightDelim[t.raw]});
      } else nodes.push({...t});
    }
    return nodes;
  }
  return read(0,tokens.length,0);
}

function isMathRun(core, source, offset, after) {
  if (!core.length) return false;
  if (/^[A-D](?:\s*[/,]\s*[A-D])+$/.test(source.slice(offset,after))) return false;
  if (core.every(t => ["open","close","bar","dash","operator","postfix","sup","sub","^","_","/"].includes(t.role))) return false;
  if (core.some(t => ["atom","unit","chemical","orbital","function","differential","root","sup","sub"].includes(t.role))) return true;
  if (core.some(t => t.role === "operator" || t.role === "/" || t.role === "^" ||
      t.role === "_" || t.role === "bar" || t.role === "postfix" || t.role === "dash")) {
    // A lone Latin answer label with a period, closing bracket or separator
    // belongs to the surrounding text.
    if (core.length === 2 && /^[A-Z]$/.test(core[0].raw) && [",",")"].includes(core[1].raw)) return false;
    return true;
  }
  if (core.length > 1) {
    if (core[0].raw === "⟨" && core.at(-1).raw === "⟩") return true;
    if (core.length === 2 && core[0].role === "variable" && core[1].role === "close") return false;
    if (core.length === 3 && core[0].raw === "(" && /^[A-D]$/.test(core[1].raw) && core[2].raw === ")") return false;
    if (core.some(t => t.role === "open" || t.role === "close")) {
      return core.some(t => t.role === "open") && core.some(t => t.role === "close");
    }
    if (core.length === 2 && core[0].role === "number" && core[1].role === "variable" && !core[1].gap) return true;
    if (core.some(t => t.role === "product")) return true;
  }
  const item = core[0];
  if (item.role === "product") return true;
  if (item.role === "variable" && !/^[ABCD]$/.test(item.raw)) {
    const around = source.slice(Math.max(0,offset-9),offset)+source.slice(after,after+9);
    return /[\u3400-\u9fff]/.test(around);
  }
  return false;
}

const answerAliases = new Map([
  ["¼",tex`\frac{1}{4}`], ["ml",tex`m_{\ell}`], ["Td",tex`\mathrm T_{\mathrm d}`], ["T𝑑",tex`\mathrm T_{\mathrm d}`],
  ["eg",tex`e_{\mathrm g}`], ["eɡ",tex`e_{\mathrm g}`], ["e₍g₎",tex`e_{\mathrm g}`], ["μr2",tex`\mu r^{2}`],
  ...["1S0","^1S_0","1S_0"].map(s => [s,tex`{}^{1}\mathrm S_{0}`]),
  ...["3P","^3P","^{3}P"].map(s => [s,tex`{}^{3}\mathrm P`]),
]);

function inferred(source, parts) {
  if (answerAliases.has(source)) { add(parts,"math",answerAliases.get(source)); return; }
  if (/^[A-Za-z][A-Za-z\s.,!?'’-]+$/.test(source) && /\s/.test(source.trim()) &&
      /\b(?:[A-Za-z]{4,}|the|is|was|are|and|or|to)\b/i.test(source)) {
    add(parts,"text",source); return;
  }
  let run = [], start = 0, i = 0;
  function flush(stop) {
    if (!run.length) return;
    let lo = 0, hi = run.length;
    while (lo < hi && run[lo].role === "space") lo++;
    while (hi > lo && run[hi-1].role === "space") hi--;
    if (lo === hi) { add(parts,"text",source.slice(start,stop)); run = []; return; }
    const from = run[lo].at, to = run[hi-1].at+run[hi-1].raw.length;
    const compact = [];
    for (let j=lo;j<hi;j++) {
      if (run[j].role === "space") continue;
      run[j].gap = j>lo && run[j-1].role === "space";
      compact.push(run[j]);
    }
    if (compact.length < 256 && isMathRun(compact,source,from,to)) {
      add(parts,"text",source.slice(start,from));
      add(parts,"math",expression(groupTree(compact)));
      add(parts,"text",source.slice(to,stop));
    } else add(parts,"text",source.slice(start,stop));
    run = [];
  }
  while (i < source.length) {
    const t = tokenAt(source,i);
    if (t.role === "text") {
      flush(i);
      add(parts,"text",t.raw);
    } else {
      if (!run.length) start = i;
      t.at = i;
      run.push(t);
    }
    i += t.raw.length;
  }
  flush(i);
}

export function scientificParts(text) {
  const result = [];
  for (const part of authoredParts(text)) {
    if (part.kind === "text") inferred(part.value,result);
    else add(result,part.kind,part.value);
  }
  return result;
}
