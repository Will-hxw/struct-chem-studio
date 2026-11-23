import { mountTutor } from "./tutor.mjs?v=10";

let current;
function closePanel(restoreFocus = false) {
  if (!current) return;
  const { panel, trigger, dispose } = current;
  current = null;
  dispose();
  panel.remove();
  trigger.setAttribute("aria-expanded", "false");
  trigger.removeAttribute("aria-controls");
  if (restoreFocus && trigger.isConnected)
    trigger.focus({ preventScroll: true });
}
function place(trigger, panel) {
  (trigger.closest(".question-tools,.lab-title") || trigger).after(panel);
  trigger.setAttribute("aria-controls", panel.id);
  trigger.setAttribute("aria-expanded", "true");
}
export function openInlineTutor(spec, trigger) {
  if (current?.trigger === trigger && current.specId === spec.id) {
    closePanel(true);
    return;
  }
  closePanel();
  const panel = document.createElement("section");
  panel.className = "inline-tutor";
  panel.id = "inline-ai-answer";
  panel.setAttribute("aria-label", trigger.textContent.trim());
  panel.innerHTML =
    '<header><strong></strong><button type="button" class="plain collapse">收起</button></header><div class="inline-body"></div>';
  panel.querySelector("strong").textContent = trigger.textContent.trim();
  panel.querySelector(".collapse").onclick = () => closePanel(true);
  place(trigger, panel);
  current = {
    panel,
    trigger,
    specId: spec.id,
    dialog: trigger.closest("dialog"),
    dispose: mountTutor(panel.querySelector(".inline-body"), spec, true),
  };
}
export function restoreInlineTutor(root) {
  if (!current || current.panel.isConnected) return;
  const { action, id, mode } = current.trigger.dataset;
  const match = [...root.querySelectorAll('[data-action="ai-question"]')].find(
    (el) =>
      action === el.dataset.action &&
      id === el.dataset.id &&
      mode === el.dataset.mode,
  );
  if (match && !current.dialog) {
    current.trigger = match;
    place(match, current.panel);
  } else closePanel();
}
export function dismissDialogTutor(dialog) {
  if (current?.dialog === dialog) closePanel();
}
