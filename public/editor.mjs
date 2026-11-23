import { rich } from "./deferred-notation.mjs";
import {
  esc,
  icon,
  chapters,
  chapter,
  types,
  letters,
  safeImage,
  difficulty,
  formOf,
} from "./ui.mjs";
import {
  normalize,
  questionOrigin,
  questionOrigins,
  inferChapter,
  inferTopic,
  readTextQuestions,
} from "./engine.mjs";
let lastFocus, ctx;
export function configure(context) {
  ctx = context;
}
export function close() {
  const el = document.querySelector("#studio-dialog");
  if (el?.open) el.close();
}
export function modal(title, body) {
  let dialog = document.querySelector("#studio-dialog");
  const opening = !dialog.open;
  if (opening) lastFocus = document.activeElement;
  dialog.innerHTML =
    '<div class="modalhead"><h2 id="modal-title">' +
    esc(title) +
    '</h2><button class="iconbtn" data-action="close" aria-label="关闭">' +
    icon("close") +
    '</button></div><div class="modalbody">' +
    body +
    "</div>";
  dialog.setAttribute("aria-labelledby", "modal-title");
  if (opening) {
    dialog.showModal();
    dialog.onclose = () => {
      if (lastFocus?.isConnected) lastFocus.focus();
    };
  }
  dialog.scrollTop = 0;
  return dialog;
}
const by = (id) => document.getElementById(id);
const selectOpts = (items, value) =>
  items
    .map(
      ([v, l]) =>
        '<option value="' +
        esc(v) +
        '" ' +
        (String(v) === String(value) ? "selected" : "") +
        ">" +
        esc(l) +
        "</option>",
    )
    .join("");
function formError(msg) {
  const e = by("form-error");
  if (e) {
    e.textContent = msg;
    e.scrollIntoView({ block: "nearest" });
  }
}
async function imageData(blob) {
  const b = await createImageBitmap(blob),
    can = document.createElement("canvas"),
    scale = Math.min(1, 1480 / Math.max(b.width, b.height));
  can.width = Math.round(b.width * scale);
  can.height = Math.round(b.height * scale);
  const c = can.getContext("2d");
  c.fillStyle = "#fff";
  c.fillRect(0, 0, can.width, can.height);
  c.drawImage(b, 0, 0, can.width, can.height);
  b.close();
  for (let quality = 0.88; quality > 0.28; quality -= 0.1) {
    const out = can.toDataURL("image/jpeg", quality);
    if (out.length <= 830000) return out;
  }
  throw Error("图片过大，请裁切为单道题后重试。");
}
export function editor(q = {}, isEdit = false) {
  let numeric = q.value ?? "",
    tol = q.tolerance ?? 0,
    unit = q.unit || "",
    accepted = (q.accepted || []).join("|"),
    legacyCalc = q.type === "计算题" && q.options?.length > 0;
  let pic = q.image || "",
    trackChapter = !!q.chapter,
    defaults = q.options?.length ? [...q.options] : ["", "", "", ""],
    answer = q.answers || [];
  const dlg = modal(
    isEdit ? "编辑题目与答案" : "录入新题",
    '<form id="edit-form"><div class="formgrid">' +
      '<label class="wide">题干<textarea id="e-stem" rows="3" required placeholder="输入题目，可附上原题图片">' +
      esc(q.stem) +
      "</textarea></label>" +
      '<label>章节<select id="e-ch">' +
      selectOpts(
        chapters.map((c) => [c.id, c.name]),
        q.chapter || 1,
      ) +
      "</select></label>" +
      '<label>题型<select id="e-type">' +
      selectOpts(
        types.map((t) => [t, t]),
        q.type || "单选题",
      ) +
      "</select></label>" +
      '<label>知识点<input id="e-topic" placeholder="例如：分子点群" value="' +
      esc(q.topic) +
      '" maxlength="90"></label>' +
      '<label>题目分类<select id="e-origin">' +
      selectOpts(
        questionOrigins.map((value) => [value, value]),
        questionOrigin(q.origin),
      ) +
      "</select></label>" +
      '<label>来源 / 原题号<input id="e-source" placeholder="例如：课后题 6.3" value="' +
      esc(q.source || "个人录入") +
      '"></label>' +
      '<label>难度<select id="e-difficulty">' +
      selectOpts(
        difficulty.slice(1).map((d, i) => [i + 1, d]),
        q.difficulty || 1,
      ) +
      '</select></label><label>同类题组<input id="e-family" placeholder="如：势箱能级计算" value="' +
      esc(q.family) +
      '"></label>' +
      '<div class="wide" id="e-opts"></div><label class="wide" id="e-exp-label"><span>解析 / 参考答案</span><textarea id="e-exp" rows="3" placeholder="写下判断依据或计算过程">' +
      esc(q.explanation) +
      "</textarea></label>" +
      '<label class="wide">评分点（每行一项）<textarea id="e-rubric" rows="2">' +
      esc((q.rubric || []).join("\n")) +
      "</textarea></label>" +
      '<label class="wide">易错点<textarea id="e-tip" rows="2" placeholder="例如：先明确离域能的符号约定">' +
      esc(q.pitfall) +
      "</textarea></label>" +
      '<div class="wide"><label>原题图片<input id="e-pic" type="file" accept="image/png,image/jpeg,image/webp"></label><div id="e-img"></div></div></div>' +
      '<p id="form-error" class="formerror" role="alert"></p><div class="formactions"><button type="button" class="btn" data-action="close">取消</button><button type="submit" class="btn primary">保存题目</button></div></form>',
  );
  const s = () => by("e-type").value;
  function gather() {
    if (by("e-value")) {
      numeric = by("e-value").value;
      tol = by("e-tol").value;
      unit = by("e-unit").value;
    }
    if (by("e-accepted")) accepted = by("e-accepted").value;
    const inputs = [...dlg.querySelectorAll(".opttext")];
    defaults = inputs.map((i) => i.value);
    answer = [...dlg.querySelectorAll(".optmark")].flatMap((el, i) =>
      el.checked ? [i] : [],
    );
  }
  function options() {
    const type = s(),
      el = by("e-opts");
    if (type === "填空题") {
      el.innerHTML =
        '<label class="formlabel">标准答案（等价答案用 | 分隔，留空时按评分点自评）<input id="e-accepted" value="' +
        esc(accepted) +
        '"></label>';
      return;
    }
    if (type === "计算题" && !legacyCalc) {
      el.innerHTML =
        '<div class="formgrid"><label>数值答案（可留空自评）<input type="number" id="e-value" step="any" value="' +
        esc(numeric) +
        '"></label><label>绝对容差<input required type="number" id="e-tol" min="0" step="any" value="' +
        esc(tol) +
        '"></label><label>答案单位<input id="e-unit" value="' +
        esc(unit) +
        '" placeholder="例：eV"></label></div>';
      return;
    }
    if (["简答题", "推导题", "作图题"].includes(type)) {
      el.innerHTML =
        '<div class="panelnote">练习时先写作答，再对照参考答案自评。</div>';
      return;
    }
    if (type === "判断题") {
      defaults = ["正确", "错误"];
      answer = answer.filter((i) => i < 2).slice(0, 1);
    }
    if (defaults.length < 2) defaults = ["", "", "", ""];
    if (type !== "多选题") answer = answer.slice(0, 1);
    el.innerHTML =
      '<div class="formlabel">选项与正确答案</div><div class="formhint">勾选正确项' +
      (type === "多选题" ? "，本题可选多项。" : "。") +
      '</div><div class="optionsedit">' +
      defaults
        .map(
          (v, i) =>
            '<div class="optedit"><input aria-label="将 ' +
            letters[i] +
            ' 设为正确答案" class="optmark" type="' +
            (type === "多选题" ? "checkbox" : "radio") +
            '" name="answer" ' +
            (answer.includes(i) ? "checked" : "") +
            "><span>" +
            letters[i] +
            '</span><input type="text" aria-label="选项 ' +
            letters[i] +
            '" class="opttext" value="' +
            esc(v) +
            '" ' +
            (type === "判断题" ? "readonly" : "") +
            " required></div>",
        )
        .join("") +
      "</div>" +
      (type === "判断题"
        ? ""
        : '<div class="tools">' +
          (defaults.length < 8
            ? '<button type="button" id="add-opt" class="plain">添加选项</button>'
            : "") +
          (defaults.length > 2
            ? '<button type="button" id="remove-opt" class="plain">移除末项</button>'
            : "") +
          "</div>");
    by("add-opt")?.addEventListener("click", () => {
      gather();
      defaults.push("");
      options();
    });
    by("remove-opt")?.addEventListener("click", () => {
      gather();
      defaults.pop();
      answer = answer.filter((i) => i < defaults.length);
      options();
    });
  }
  async function recognizePic() {
    const panel = by("ocr-panel"),
      status = by("ocr-status"),
      start = by("read-pic");
    if (!panel || !start || start.disabled) return;
    start.disabled = true;
    status.textContent = "正在载入中文识别模型…";
    try {
      const { recognize } = await import("./ocr.mjs"),
        raw = await recognize(pic, (n) => {
          status.textContent = "正在识别文字 " + n + "%";
        });
      if (!panel.isConnected) return;
      if (!raw) throw Error("未识别到文字，请按原图录入。");
      status.textContent = "请核对希腊字母、上下标与答案。";
      const lines = raw
        .replace(/([A-H])[．、）)]/g, "$1.")
        .split(/\n/)
        .map((x) => x.trim())
        .filter(Boolean);
      let stem = [],
        items = [],
        current = -1;
      for (const line of lines) {
        const opt = line.match(/^([A-H])[.:：]\s*(.*)$/);
        if (opt) {
          items.push(opt[2]);
          current = items.length - 1;
        } else if (/^(答案|解析|易错点)[：:]/.test(line)) {
          current = -2;
        } else if (current === -1) stem.push(line);
        else if (current >= 0) items[current] += " " + line;
      }
      if (!by("e-stem").value.trim()) {
        by("e-stem").value = stem.join(" ") || raw;
        by("e-stem").dispatchEvent(new Event("blur"));
      }
      if (items.length >= 2 && items.length <= 8 && defaults.every((x) => !x)) {
        defaults = items;
        answer = [];
        options();
      }
      const output = document.createElement("details");
      output.className = "method";
      const summary = document.createElement("summary");
      summary.textContent = "查看识别全文";
      const pre = document.createElement("p");
      pre.className = "notearea";
      pre.textContent = raw;
      output.append(summary, pre);
      panel.append(output);
    } catch (err) {
      status.textContent = "识别未完成，可按原图录入或重试。";
    } finally {
      start.disabled = false;
    }
  }
  function picView() {
    by("e-img").innerHTML = safeImage(pic)
      ? '<img class="questionimg" alt="原题图片" src="' +
        pic +
        '"><button type="button" id="del-pic" class="plain">移除图片</button><div id="ocr-panel" class="panelnote"><button type="button" class="btn small" id="read-pic">识别题图文字</button> <span id="ocr-status" class="formhint">识别后可校对题干与选项。</span></div>'
      : "";
    by("read-pic")?.addEventListener("click", recognizePic);
    by("del-pic")?.addEventListener("click", () => {
      pic = "";
      picView();
    });
  }
  options();
  picView();
  by("e-type").onchange = () => {
    gather();
    legacyCalc = false;
    options();
  };
  by("e-ch").onchange = () => (trackChapter = true);
  by("e-stem").onblur = () => {
    const v = by("e-stem").value;
    if (!trackChapter && v) by("e-ch").value = inferChapter(v);
    if (!by("e-topic").value && v)
      by("e-topic").value = inferTopic(v, +by("e-ch").value);
  };
  if (pic && !isEdit && !q.stem) setTimeout(recognizePic, 1);
  by("e-pic").onchange = async (e) => {
    try {
      if (e.target.files[0]) pic = await imageData(e.target.files[0]);
      picView();
    } catch (err) {
      formError(err.message);
    }
  };
  by("edit-form").onsubmit = async (e) => {
    e.preventDefault();
    const submit = e.submitter;
    submit.disabled = true;
    try {
      gather();
      const result = normalize({
        id: q.id || "q-" + crypto.randomUUID(),
        chapter: by("e-ch").value,
        type: s(),
        difficulty: +by("e-difficulty").value,
        family: by("e-family").value,
        rubric: by("e-rubric")
          .value.split(/\n/)
          .map((x) => x.trim())
          .filter(Boolean),
        value:
          s() === "计算题" && !legacyCalc && String(numeric).trim()
            ? Number(numeric)
            : null,
        tolerance: s() === "计算题" && !legacyCalc ? Number(tol) : null,
        unit,
        accepted:
          s() === "填空题"
            ? accepted
                .split("|")
                .map((x) => x.trim())
                .filter(Boolean)
            : [],
        url: q.url || "",
        stem: by("e-stem").value,
        topic: by("e-topic").value,
        options: defaults,
        answers: answer,
        explanation: by("e-exp").value,
        pitfall: by("e-tip").value,
        origin: by("e-origin").value,
        source: by("e-source").value,
        hint: q.hint,
        unordered: q.unordered,
        image: pic,
        figures: q.figures,
        draw: q.draw,
      });
      await ctx.saveQuestions([result]);
      close();
      ctx.toast(isEdit ? "已更新题目，正确率已重新计算" : "新题已加入题库");
    } catch (err) {
      formError(err.message);
    } finally {
      submit.disabled = false;
    }
  };
}
const example =
  "HOCl 的平衡构型属于哪个点群？\nA. C₂ᵥ\nB. Cₛ\nC. D∞h\nD. Tᵈ\n答案：B\n解析：折线形三原子分子只有分子平面这个镜面。\n知识点：点群判断";
function download(name, blob) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
export function backup() {
  const snapshot = {
    format: "chem-studio-v1",
    exportedAt: new Date().toISOString(),
    events: ctx.events().map(({ pending, ...e }) => e),
  };
  download(
    "结构化学-学习备份-" + new Date().toISOString().slice(0, 10) + ".json",
    new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }),
  );
  ctx.toast("学习备份已导出");
}
export function importer() {
  const dlg = modal(
    "导入题目",
    '<div class="filearea"><label for="import-file">' +
      icon("upload") +
      '选择题目文件</label><input id="import-file" type="file" accept=".txt,.json,.pdf,image/png,image/jpeg,image/webp"><p class="formhint">支持 TXT、JSON、PDF 和题图。题图支持中英文文字识别，扫描 PDF 可选页识别。</p></div><div id="pdf-controls"></div><label class="formlabel">粘贴或校对题目文本<textarea id="import-text" rows="10" placeholder="' +
      esc(example) +
      '"></textarea></label><p class="formhint">选项用 A.、B. 标注，答案写成“答案：B”。多题用单独一行 --- 分隔。填空题注明题型和答案；数值计算题可写单位和容差。也可添加知识点、难度、解析和评分点。</p><button id="template" class="plain">' +
      icon("download", 15) +
      '下载导入示例</button><p id="form-error" class="formerror" role="alert"></p><div class="formactions"><button class="btn" data-action="close">取消</button><button class="btn primary" id="import-review">检查并预览</button></div>',
  );
  let filename = "",
    pdf = null,
    backupRows = null,
    jsonRows = null;
  by("template").onclick = () =>
    download(
      "结构化学-导入示例.txt",
      new Blob(
        [
          example +
            "\n---\n" +
            "在一维无限深势箱中，能量与 n² 成正比。\n答案：正确\n知识点：势箱能级\n解析：Eₙ = n²h²/(8mL²)。",
        ],
        { type: "text/plain;charset=utf-8" },
      ),
    );
  function resetParsed() {
    jsonRows = null;
    backupRows = null;
  }
  by("import-text").oninput = resetParsed;
  by("import-file").onchange = async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    filename = f.name;
    resetParsed();
    by("pdf-controls").innerHTML = "";
    formError("");
    by("import-text").value = "";
    by("import-text").disabled = false;
    try {
      if (f.size > 35 * 1024 * 1024) throw Error("请选择 35 MB 以内的文件。");
      if (f.type.startsWith("image/")) {
        const pic = await imageData(f);
        editor({ image: pic, source: f.name });
        return;
      }
      if (/\.pdf$/i.test(f.name)) {
        by("pdf-controls").textContent = "正在读取 PDF…";
        const pdfjs = await import("/vendor/pdf.min.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
        pdf = await pdfjs.getDocument({
          data: await f.arrayBuffer(),
          isEvalSupported: false,
          useSystemFonts: true,
        }).promise;
        by("pdf-controls").innerHTML =
          '<div class="panelnote"><div class="tools"><label>页码 <input id="pdf-page" type="number" value="1" min="1" max="' +
          pdf.numPages +
          '" style="width:70px"> / ' +
          pdf.numPages +
          '</label><button class="btn small" id="pdf-read">提取本页文字</button><button class="btn small" id="pdf-image">用本页图录题</button></div></div>';
        async function getPage() {
          const n = Number(by("pdf-page").value);
          if (!Number.isInteger(n) || n < 1 || n > pdf.numPages)
            throw Error("请输入有效页码。");
          return pdf.getPage(n);
        }
        const extract = async () => {
          try {
            const pg = await getPage(),
              t = await pg.getTextContent();
            by("import-text").value = t.items
              .map((x) => x.str + (x.hasEOL ? "\n" : " "))
              .join("")
              .trim();
            formError(
              by("import-text").value
                ? ""
                : "本页没有可提取文字，可选择“用本页图录题”。",
            );
          } catch (e) {
            formError(e.message);
          }
        };
        by("pdf-read").onclick = extract;
        by("pdf-image").onclick = async () => {
          try {
            const pg = await getPage(),
              v = pg.getViewport({ scale: 1.55 }),
              c = document.createElement("canvas");
            c.width = v.width;
            c.height = v.height;
            await pg.render({
              canvas: c,
              canvasContext: c.getContext("2d"),
              viewport: v,
            }).promise;
            const pic = await imageData(
              await new Promise((res) => c.toBlob(res, "image/png")),
            );
            editor({
              image: pic,
              source: f.name + " 第 " + pg.pageNumber + " 页",
            });
          } catch (e) {
            formError(e.message);
          }
        };
        await extract();
        return;
      }
      const text = await f.text();
      if (/\.json$/i.test(f.name)) {
        const obj = JSON.parse(text);
        if (obj.format === "chem-studio-v1" && Array.isArray(obj.events)) {
          backupRows = obj.events;
          by("import-text").value =
            "学习备份 · " + backupRows.length + " 条记录";
          by("import-text").disabled = true;
        } else {
          const rows = Array.isArray(obj) ? obj : obj.questions;
          if (!Array.isArray(rows))
            throw Error("JSON 需要一个题目数组或 questions 字段。");
          jsonRows = rows.map(normalize);
          by("import-text").value = jsonRows.map((q) => q.stem).join("\n");
          by("import-text").disabled = true;
        }
      } else by("import-text").value = text;
    } catch (e) {
      formError("文件读取失败：" + e.message);
    }
  };
  by("import-review").onclick = () => {
    try {
      if (backupRows) {
        const rows = backupRows.map((e) => {
          if (
            !e ||
            ![
              "attempt",
              "favorite",
              "goal",
              "question",
              "reason",
              "exam",
              "dialogue",
            ].includes(e.kind) ||
            !Number.isSafeInteger(e.at) ||
            !e.data ||
            typeof e.data !== "object" ||
            !/^[-\w]{8,88}$/.test(e.id)
          )
            throw Error("备份记录格式有误。");
          if (e.kind === "question") normalize(e.data);
          if (
            e.kind === "attempt" &&
            (!e.data.qid ||
              (!e.data.missed &&
                !Array.isArray(e.data.choice) &&
                typeof e.data.grade !== "boolean" &&
                typeof e.data.text !== "string"))
          )
            throw Error("作答记录有误。");
          return e;
        });
        const m = modal(
          "恢复学习备份",
          '<p class="muted">将合并 ' +
            rows.length +
            ' 条学习记录，已有相同记录会自动跳过。</p><div class="formactions"><button class="btn" data-action="close">取消</button><button class="btn primary" id="restore-yes">确认合并</button></div><p id="form-error" class="formerror"></p>',
        );
        m.querySelector("#restore-yes").onclick = async (e) => {
          e.target.disabled = true;
          try {
            await ctx.restore(rows);
            close();
            ctx.toast("备份已合并");
          } catch (er) {
            formError(er.message);
            e.target.disabled = false;
          }
        };
        return;
      }
      const value = by("import-text").value.trim();
      if (!jsonRows && !value) throw Error("请先选择文件或粘贴题目。");
      const qs = jsonRows || readTextQuestions(value);
      if (!qs.length) throw Error("未识别到题目。");
      const known = new Set(ctx.model().qs.map((q) => q.stem.trim()));
      const fresh = qs.filter((q) => {
        if (known.has(q.stem.trim())) return false;
        known.add(q.stem.trim());
        return true;
      });
      modal(
        "确认导入",
        '<p class="panelnote">识别 ' +
          qs.length +
          " 道题，可新增 " +
          fresh.length +
          " 道，重复 " +
          (qs.length - fresh.length) +
          ' 道。</p><div class="diffs">' +
          fresh
            .map(
              (q) =>
                '<div class="qrow"><div>' +
                rich(q.stem) +
                '<div class="source">' +
                esc(chapter(q.chapter).name) +
                " · " +
                esc(q.topic) +
                " · " +
                esc(q.type) +
                "</div></div></div>",
            )
            .join("") +
          '</div><div class="formactions"><button class="btn" data-action="close">取消</button><button class="btn primary" id="do-import" ' +
          (!fresh.length ? "disabled" : "") +
          ">确认导入 " +
          fresh.length +
          ' 道</button></div><p id="form-error" class="formerror"></p>',
      );
      by("do-import").onclick = async (e) => {
        e.target.disabled = true;
        try {
          await ctx.saveQuestions(
            fresh.map((q) => ({
              ...q,
              id: "q-" + crypto.randomUUID(),
              source: filename && q.source === "文本导入" ? filename : q.source,
            })),
          );
          close();
          ctx.toast("已导入 " + fresh.length + " 道题目");
        } catch (er) {
          formError(er.message);
          e.target.disabled = false;
        }
      };
    } catch (e) {
      formError(e.message);
    }
  };
}
