const records = new Map();
const drafts = new Map();
const pending = new Map();
const locked = new Set();
let account,
  cursor = 0,
  pulling,
  timer,
  onStatus = () => {},
  onRemote = () => {};
export const events = () => Array.from(records.values());
export const identity = () => account ?? {};
export const draft = (kind) => drafts.get(kind)?.data ?? null;
function invalidate() {
  document.getElementById("studio")?.replaceChildren();
  location.reload();
}
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      ...(account?.scope ? { "X-Study-Scope": account.scope } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || (res.status === 409 && !data.conflict)) {
    invalidate();
    throw Error("请重新登录。");
  }
  if (!res.ok)
    throw Object.assign(Error(data.error || "无法连接数据库，请重试。"), {
      conflict: data.conflict,
    });
  return data;
}
async function pull(firstPage) {
  let changed = false,
    more = true;
  while (more) {
    const page = firstPage ?? await api("/api/study?cursor=" + cursor);
    firstPage = null;
    for (const row of page.events) {
      if (!records.has(row.id)) {
        records.set(row.id, row);
        changed = true;
      }
    }
    cursor = page.cursor;
    more = page.more;
  }
  return changed;
}
export async function sync() {
  if (pulling) return pulling;
  pulling = (async () => {
    try {
      if (await pull()) onRemote();
      await flush();
    } catch (e) {
      onStatus(e.message);
    }
  })();
  try {
    await pulling;
  } finally {
    pulling = null;
  }
}
export async function init(status, remote, initialData) {
  onStatus = status;
  onRemote = remote;
  const initial = await initialData;
  account = initial.account;
  await pull(initial.page);
  for (const d of initial.drafts) drafts.set(d.kind, d);
  onStatus("已保存至账号");
  window.addEventListener("online", sync);
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) invalidate();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) void flush();
    else void sync();
  });
  window.addEventListener("pagehide", () => {
    void flush();
  });
}
export async function add(kind, data, id = crypto.randomUUID()) {
  if (records.has(id)) return;
  const row = { kind, data, id, at: Date.now() };
  await putEvent(row);
}
async function putEvent(row) {
  try {
    await api("/api/study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    records.set(row.id, row);
    if (!pending.size) onStatus("已保存至账号");
  } catch (e) {
    onStatus("保存失败，请重试");
    throw e;
  }
}
export async function restore(rows) {
  for (const { kind, data, id, at } of rows)
    if (!records.has(id)) await putEvent({ kind, data, id, at });
}
export function saveDraft(kind, data) {
  if (!account || locked.has(kind)) return;
  const json = JSON.stringify(data);
  const prior = pending.get(kind);
  if (prior === json || (!prior && json === JSON.stringify(draft(kind))))
    return;
  pending.set(kind, json);
  onStatus("正在保存进度…");
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), 250);
}
const jobs = new Map();
async function sendDraft(kind) {
  if (jobs.has(kind)) return jobs.get(kind);
  const job = (async () => {
    while (pending.has(kind) && !locked.has(kind)) {
      const text = pending.get(kind);
      const data = JSON.parse(text);
      const body = JSON.stringify({
        kind,
        data,
        base: drafts.get(kind)?.version ?? 0,
      });
      try {
        const result = await api("/api/drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: body.length < 12000,
        });
        drafts.set(kind, { kind, data, version: result.version });
        if (pending.get(kind) === text) pending.delete(kind);
      } catch (e) {
        if (e.conflict) {
          locked.add(kind);
          onStatus("另一设备已更新进度，点账号查看");
          window.dispatchEvent(
            new CustomEvent("study-conflict", { detail: e.message }),
          );
        } else onStatus("进度未保存，联网后重试");
        break;
      }
    }
  })();
  jobs.set(kind, job);
  try {
    await job;
  } finally {
    jobs.delete(kind);
  }
}
export async function flush() {
  clearTimeout(timer);
  await Promise.all([...pending.keys()].map(sendDraft));
  if (!pending.size) onStatus("已保存至账号");
  return pending.size === 0;
}
