// Idempotent setup of static/ symlinks (or junctions on Windows) into
// data-repo/data/. Wired to npm postinstall so a fresh clone works after
// `npm install` with no further steps. See CLAUDE.md "First-time setup".
//
// Without this, the dev server returns 404 for every JSON request and
// list pages render empty — easy to misdiagnose as a code bug.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STATIC_DIR = path.join(ROOT, "static");
const DATA_DIR = path.join(ROOT, "data-repo", "data");

// Each entry: name in static/, target relative to static/, kind for Windows.
const LINKS = [
  { name: "tablets",           target: "../data-repo/data/tablets",           kind: "junction" },
  { name: "pens",              target: "../data-repo/data/pens",              kind: "junction" },
  { name: "pen-families",      target: "../data-repo/data/pen-families",      kind: "junction" },
  { name: "tablet-families",   target: "../data-repo/data/tablet-families",   kind: "junction" },
  { name: "pen-compat",        target: "../data-repo/data/pen-compat",        kind: "junction" },
  { name: "drivers",           target: "../data-repo/data/drivers",           kind: "junction" },
  { name: "pressure-response", target: "../data-repo/data/pressure-response", kind: "junction" },
  { name: "inventory",         target: "../data-repo/data/inventory",         kind: "junction" },
  { name: "brands",            target: "../data-repo/data/brands",            kind: "junction" },
  { name: "reference",         target: "../data-repo/data/reference",         kind: "junction" },
  { name: "version.json",      target: "../data-repo/data/version.json",      kind: "file" },
];

function symlinkType(kind) {
  // On Windows, fs.symlinkSync requires "junction" for directories (no admin
  // needed) and "file" for files. On POSIX the kind argument is ignored.
  return process.platform === "win32" ? kind : null;
}

function ensureLink({ name, target, kind }) {
  const linkPath = path.join(STATIC_DIR, name);

  // If data-repo isn't checked out (e.g. someone forgot
  // `git submodule update --init`), skip rather than create a dangling link.
  if (!fs.existsSync(DATA_DIR)) {
    console.warn(`[setup-static] data-repo/data not found — run 'git submodule update --init --recursive' first; skipping`);
    return "skipped-no-data-repo";
  }

  let stat;
  try {
    stat = fs.lstatSync(linkPath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  if (stat) {
    if (stat.isSymbolicLink()) {
      const existing = fs.readlinkSync(linkPath);
      if (existing === target) return "ok";
      // Different target — replace it.
      fs.unlinkSync(linkPath);
    } else {
      // A real file or directory is in the way. Don't clobber — report it.
      console.warn(`[setup-static] ${name}: real ${stat.isDirectory() ? "directory" : "file"} present, not a symlink — leaving alone`);
      return "skipped-real-file";
    }
  }

  fs.mkdirSync(STATIC_DIR, { recursive: true });
  fs.symlinkSync(target, linkPath, symlinkType(kind));
  return "created";
}

const summary = { created: 0, ok: 0, skipped: 0 };
for (const link of LINKS) {
  const result = ensureLink(link);
  if (result === "created") summary.created++;
  else if (result === "ok") summary.ok++;
  else summary.skipped++;
}

console.log(
  `[setup-static] ${summary.created} created, ${summary.ok} already linked, ${summary.skipped} skipped`,
);
