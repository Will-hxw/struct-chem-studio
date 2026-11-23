import { questionOrigins } from "./engine.mjs";

export function originSelect(id, selected) {
  return `<select id="${id}" aria-label="来源"><option value="">全部来源</option>${questionOrigins
    .map(
      (origin) =>
        `<option value="${origin}"${origin === selected ? " selected" : ""}>${origin}</option>`,
    )
    .join("")}</select>`;
}
