// Fails when package-lock.json lists a package whose dependency has no entry.
//
// npm on Windows sometimes drops the @emnapi/* packages that the wasm32
// fallbacks of sharp and tailwind need. Windows `npm ci` tolerates the gap,
// but Linux `npm ci` (CI, Vercel) rejects the lockfile as out of sync.
// Fix by regenerating: delete node_modules and package-lock.json, run npm install.
import { readFileSync } from "node:fs";

const { packages } = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url)));
const keys = new Set(Object.keys(packages));

/** Resolves `dep` from `from` the way Node does: nearest node_modules upward. */
function resolves(from, dep) {
  let base = from;
  for (;;) {
    if (keys.has(`${base ? `${base}/` : ""}node_modules/${dep}`)) return true;
    if (base === "") return false;
    const i = base.lastIndexOf("/node_modules/");
    base = i < 0 ? "" : base.slice(0, i);
  }
}

const missing = [];
for (const [path, entry] of Object.entries(packages)) {
  if (!path) continue;
  const deps = { ...entry.dependencies, ...entry.optionalDependencies };
  for (const dep of Object.keys(deps)) {
    if (!resolves(path, dep)) missing.push(`${dep} (needed by ${path})`);
  }
}

if (missing.length > 0) {
  console.error("package-lock.json is missing entries that Linux `npm ci` requires:");
  for (const m of missing) console.error(`  - ${m}`);
  console.error("Regenerate it: delete node_modules and package-lock.json, then run npm install.");
  process.exit(1);
}
console.log("package-lock.json: all dependencies have entries.");
