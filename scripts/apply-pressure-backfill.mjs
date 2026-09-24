#!/usr/bin/env -S npx tsx
/**
 * Apply (force, 0) and/or (force, 100) endpoint records to existing
 * pressure-response sessions in the data-repo. Each brand's JSON file is
 * read, the new tuples are added to the matching sessions' Records, and
 * the file is written back through writeDataJson
 * (data-repo/lib/data-json.ts), the dataset's one canonical JSON writer
 * (2-space indent, LF, UTF-8 without BOM; RFC #45). On an
 * already-canonical file the diff is just the added tuples.
 *
 * Input: a JSON file produced by the /pressure-backfill dev UI, with
 * one entry per session edit:
 *   {
 *     "_id":              "<uuid>",        // session UUID (canonical lookup key)
 *     "brand":            "WACOM",
 *     "inventoryId":      "WAP.0001",      // for the log line only
 *     "date":             "2024-09-02",    // for the log line only
 *     "entityId":         "wacom.session.wap.0001_2024-09-02",
 *     "penLabel":         "Pro Pen 2 (KP-504E)",
 *     "prependPiafForce":  2.2,             // optional — gets prepended as [force, 0]
 *     "appendPmaxForce":  714              // optional — gets appended as [force, 100]
 *   }
 *
 * Usage (run with tsx — the script imports a .ts module):
 *   npx tsx scripts/apply-pressure-backfill.mjs [path/to/edits.json] [--dry-run]
 *
 * Defaults to scripts/pressure-backfill-edits.json when no path is given.
 * With --dry-run, prints what it WOULD change without writing files.
 * --data-dir <dir> reads and writes <dir> instead of data-repo/data (for
 * testing against a copy).
 *
 * Per issue #212. After running, validate with `npm run data-quality`.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { readDataJson, writeDataJson } from '../data-repo/lib/data-json.ts';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const dataDirAt = args.indexOf('--data-dir');
const dataDirArg = dataDirAt >= 0 ? args.splice(dataDirAt, 2)[1] : undefined;
if (dataDirAt >= 0 && !dataDirArg) {
	console.error('--data-dir needs a directory');
	process.exit(1);
}
const DATA_DIR = dataDirArg ? path.resolve(dataDirArg) : path.join(ROOT, 'data-repo', 'data');
const PR_DIR = path.join(DATA_DIR, 'pressure-response');

const dryRun = args.includes('--dry-run');
const editsPath = path.resolve(
	args.find((a) => !a.startsWith('--')) ??
		path.join(ROOT, 'scripts', 'pressure-backfill-edits.json'),
);

if (!fs.existsSync(editsPath)) {
	console.error(`Edits file not found: ${editsPath}`);
	process.exit(1);
}

const edits = JSON.parse(fs.readFileSync(editsPath, 'utf8'));
if (!Array.isArray(edits)) {
	console.error(`Edits file must contain a JSON array; got ${typeof edits}`);
	process.exit(1);
}

// Forces are rounded to 1dp and stored as plain JSON numbers, like the
// rest of each session's Records (add-pressure-session.mjs does the same).
const round = (n, dp) => +n.toFixed(dp);

/**
 * Apply the prepend/append edit to its session inside the parsed brand
 * file (mutates `doc`). Throws if the session's _id or Records array
 * can't be found.
 */
function applyEdit(doc, edit) {
	const session = doc.PressureResponse.find((s) => s._id === edit._id);
	if (!session) throw new Error(`Session ${edit._id} not found in file`);
	if (!Array.isArray(session.Records)) throw new Error(`Records not found for ${edit._id}`);

	if (typeof edit.prependPiafForce === 'number') {
		session.Records.unshift([round(edit.prependPiafForce, 1), 0]);
	}
	if (typeof edit.appendPmaxForce === 'number') {
		session.Records.push([round(edit.appendPmaxForce, 1), 100]);
	}
}

// --- Group edits by brand and apply per file ------------------------------

const byBrand = new Map();
for (const e of edits) {
	if (!e._id || !e.brand) {
		console.error('Edit missing _id or brand:', e);
		process.exit(1);
	}
	if (e.prependPiafForce === undefined && e.appendPmaxForce === undefined) {
		console.warn(`Skipping ${e._id} (${e.inventoryId} ${e.date}): no force values`);
		continue;
	}
	if (!byBrand.has(e.brand)) byBrand.set(e.brand, []);
	byBrand.get(e.brand).push(e);
}

let totalApplied = 0;
let totalPrepend = 0;
let totalAppend = 0;

for (const [brand, brandEdits] of byBrand) {
	const filePath = path.join(PR_DIR, `${brand}-pressure-response.json`);
	if (!fs.existsSync(filePath)) {
		console.error(`Brand file not found: ${filePath}`);
		process.exit(1);
	}

	const doc = readDataJson(filePath);
	if (!Array.isArray(doc.PressureResponse)) {
		console.error(`No PressureResponse array in ${filePath}`);
		process.exit(1);
	}
	let tuples = 0;

	console.log(`\n[${brand}] ${brandEdits.length} sessions`);
	for (const e of brandEdits) {
		const tag = `${e.inventoryId} ${e.date}`;
		try {
			applyEdit(doc, e);
			const parts = [];
			if (typeof e.prependPiafForce === 'number') {
				parts.push(`Piaf=${round(e.prependPiafForce, 1)}`);
				totalPrepend++;
				tuples++;
			}
			if (typeof e.appendPmaxForce === 'number') {
				parts.push(`Pmax=${round(e.appendPmaxForce, 1)}`);
				totalAppend++;
				tuples++;
			}
			console.log(`  ✓ ${tag.padEnd(22)} ${parts.join(' ')}`);
			totalApplied++;
		} catch (err) {
			console.error(`  ✗ ${tag.padEnd(22)} ${err.message}`);
			process.exit(1);
		}
	}

	console.log(
		`[${brand}] ${dryRun ? 'would write' : 'writing'} ${path.relative(ROOT, filePath)} ` +
			`(+${tuples} records)`,
	);
	if (!dryRun) writeDataJson(filePath, doc);
}

console.log(
	`\nApplied ${totalApplied} edits (${totalPrepend} Piaf prepends, ${totalAppend} Pmax appends).`,
);
if (dryRun) console.log('Dry-run only — no files written.');
else console.log(`Now run \`npm run data-quality\` to validate.`);
