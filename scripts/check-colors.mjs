// Fails when a colour literal appears outside src/app/globals.css
// (CLAUDE.md rule 7, docs/design-system.md §9).
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = "src";
const ALLOWED = new Set([path.normalize("src/app/globals.css")]);
const SKIP_DIRS = new Set([path.normalize("src/generated")]);
const EXTENSIONS = new Set([".ts", ".tsx", ".css", ".mdx"]);
const PATTERN = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (SKIP_DIRS.has(path.normalize(full))) continue;
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(path.extname(name))) yield full;
  }
}

const problems = [];
for (const file of walk(ROOT)) {
  if (ALLOWED.has(path.normalize(file))) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      // Ignore HTML entities / anchors like href="#main" and JSX ids.
      const code = line.replace(/href="#[\w-]+"/g, "");
      if (PATTERN.test(code)) problems.push(`${file}:${i + 1}: ${line.trim()}`);
    });
}

if (problems.length) {
  console.error("Colour literals found outside src/app/globals.css:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("check-colors: ok");
