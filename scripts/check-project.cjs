// Run from any directory: node scripts/check-project.cjs
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
let errors = 0,
  links = 0;
function exists(target, source) {
  links++;
  if (!fs.existsSync(target)) {
    console.error(
      "Chemin absent : " +
        path.relative(root, target) +
        " (depuis " +
        source +
        ")",
    );
    errors++;
  }
}
function walk(folder) {
  return fs
    .readdirSync(folder, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(folder, entry.name))
        : [path.join(folder, entry.name)],
    );
}
for (const file of [
  path.join(root, "index.html"),
  ...walk(path.join(root, "pages")),
]) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const value = match[1];
    if (/^(?:https?:|mailto:|data:)/.test(value)) continue;
    const target = path.resolve(path.dirname(file), value.split(/[?#]/)[0]);
    if (
      path.basename(target) === "Trame-Studio.html" &&
      !fs.existsSync(target)
    ) {
      console.warn(
        "Note : le lien Trame Studio reste à renseigner ou son fichier à ajouter.",
      );
      continue;
    }
    exists(target, path.relative(root, file));
  }
  for (const match of text.matchAll(
    /<script type="importmap">([\s\S]*?)<\/script>/g,
  )) {
    const map = JSON.parse(match[1]);
    for (const value of Object.values(map.imports))
      exists(path.resolve(path.dirname(file), value), "importmap");
  }
}
const modules = walk(path.join(root, "src/js")).filter((file) =>
  file.endsWith(".js"),
);
for (const file of modules) {
  const text = fs.readFileSync(file, "utf8");
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    errors++;
  }
  for (const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))
    exists(
      path.resolve(path.dirname(file), match[1]),
      path.relative(root, file),
    );
  for (const match of text.matchAll(
    /new URL\(['"](\.[^'"]+)['"],\s*import\.meta\.url\)/g,
  ))
    exists(
      path.resolve(path.dirname(file), match[1].split(/[?#]/)[0]),
      path.relative(root, file),
    );
}
const model = path.join(root, "assets/models/brain.glb");
exists(model, "modèle 3D");
if (fs.existsSync(model)) {
  const b = fs.readFileSync(model);
  if (b.toString("ascii", 0, 4) !== "glTF" || b.readUInt32LE(8) !== b.length) {
    console.error("Fichier GLB invalide");
    errors++;
  }
}
for (const file of ["assets/vendor/LICENSE", "assets/models/SOURCE.txt"])
  exists(path.join(root, file), "attributions");
if (errors) {
  console.error(errors + " erreur(s).");
  process.exitCode = 1;
} else
  console.log(
    modules.length +
      " modules JavaScript, " +
      links +
      " chemins locaux et modèle GLB : OK.",
  );
