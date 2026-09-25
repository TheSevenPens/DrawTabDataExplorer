#!/usr/bin/env -S npx tsx
/**
 * Apply (force, 0) and/or (force, 100) endpoint records to existing
 * pressure-response sessions in the data-repo. Sessions are authored one per
 * file (data-repo/source/pressure-response/<brand>/<EntityId>.json, RFC #45
 * phase 5): each matching session's source gets the new tuples and is
 * written back with writeSourceRecord, then the brand bundles are
 * regenerated once. Every edit is checked before anything is written.
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
 * --repo-root <dir> edits that data-repo copy (holding source/ and data/)
 * instead of data-repo/ (for testing).
 *
 * Per issue #212. After running, validate with `npm run data-quality`.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import {
	readSources,
	regenerate,
	sourceCollection,
	writeSourceRecord,
} from '../data-repo/lib/sources.ts';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const rootAt = args.indexOf('--repo-root');
const rootArg = rootAt >= 0 ? args.splice(rootAt, 2)[1] : undefined;
if (rootAt >= 0 && !rootArg) {
	console.error('--repo-root needs a directory');
	process.exit(1);
}
const REPO_ROOT = rootArg ? path.resolve(rootArg) : path.join(ROOT, 'data-repo');

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
 * Apply the prepend/append edit to a session record (mutates it). Throws
 * if its Records array is missing.
 */
function applyEdit(session, edit) {
	if (!Array.isArray(session.Records)) throw new Error(`Records not found for ${edit._id}`);

	if (typeof edit.prependPiafForce === 'number') {
		session.Records.unshift([round(edit.prependPiafForce, 1), 0]);
	}
	if (typeof edit.appendPmaxForce === 'number') {
		session.Records.push([round(edit.appendPmaxForce, 1), 100]);
	}
}

// --- Load the session sources (the only editable copy) ---------------------

const sessions = sourceCollection('pressure-response');
const { records, issues } = readSources(REPO_ROOT, sessions);
if (issues.length) {
	console.error('Session source problems (fix these first; nothing was written):');
	for (const i of issues) console.error(`  ${i.file}: ${i.problem}`);
	process.exit(1);
}
const byId = new Map(records.map((r) => [r.record._id, r]));

// --- Group edits by brand and apply ----------------------------------------

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
const touched = [];

for (const [brand, brandEdits] of byBrand) {
	let tuples = 0;
	console.log(`\n[${brand}] ${brandEdits.length} sessions`);
	for (const e of brandEdits) {
		const tag = `${e.inventoryId} ${e.date}`;
		try {
			const src = byId.get(e._id);
			if (!src || src.brand !== brand) {
				throw new Error(`Session ${e._id} not found in the ${brand} sources`);
			}
			applyEdit(src.record, e);
			touched.push(src);
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
			console.log(`  ✓ ${tag.padEnd(22)} ${parts.join(' ')}  ${src.file}`);
			totalApplied++;
		} catch (err) {
			console.error(`  ✗ ${tag.padEnd(22)} ${err.message}`);
			process.exit(1);
		}
	}
	console.log(`[${brand}] +${tuples} records`);
}

// All edits validated before anything is written.
if (!dryRun) {
	for (const { record } of touched) writeSourceRecord(REPO_ROOT, sessions, record);
	for (const f of regenerate(REPO_ROOT)) console.log(`Regenerated ${f}`);
}

console.log(
	`\nApplied ${totalApplied} edits (${totalPrepend} Piaf prepends, ${totalAppend} Pmax appends).`,
);
if (dryRun) console.log('Dry-run only — no files written.');
else console.log('Now run `npm run data-quality` to validate.');
