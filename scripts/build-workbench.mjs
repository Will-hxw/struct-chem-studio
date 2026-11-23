import { build } from "esbuild";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { basename } from "node:path";
const result = await build({
  entryPoints: ["public/study.mjs"],
  minify: true,
  bundle: true,
  splitting: true,
  format: "esm",
  outdir: "public/workbench",
  entryNames: "[name]-[hash]",
  chunkNames: "part-[hash]",
  external: ["/vendor/*"],
  metafile: true,
});
const sources = [
  "interface",
  "studio-tools",
  "lab/geometry",
  "lab/electronic",
  "editorial",
  "learning",
];
const css = await build({
  stdin: {
    contents: sources.map((name) => '@import "./' + name + '.css";').join("\n"),
    loader: "css",
    resolveDir: "public",
  },
  bundle: true,
  minify: true,
  outdir: "public/workbench",
  entryNames: "layout-[hash]",
  metafile: true,
});
const output = (result, match) =>
  "/workbench/" + basename(Object.keys(result.metafile.outputs).find(match));
await mkdir("lib/generated", { recursive: true });
await writeFile(
  "lib/generated/workbench.json",
  JSON.stringify({
    script: output(
      result,
      (key) => result.metafile.outputs[key].entryPoint === "public/study.mjs",
    ),
    style: output(css, (key) => key.endsWith(".css")),
  }),
);

const produced = new Set([...Object.keys(result.metafile.outputs), ...Object.keys(css.metafile.outputs)].map(file => basename(file)));
for(const file of await readdir("public/workbench")) {
  if(/^(?:study|part|layout)-[A-Z0-9]{8}\.(?:js|css)$/.test(file) && !produced.has(file))
    await unlink("public/workbench/"+file);
}
