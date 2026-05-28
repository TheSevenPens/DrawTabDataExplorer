#!/usr/bin/env node
/**
 * Apply (force, 0) and/or (force, 100) endpoint records to existing
 * pressure-response sessions in the data-repo, surgically splicing the
 * new tuples into each brand's JSON file in-place while preserving the
 * PowerShell wide-indent formatting (29-space record braces, 33-space
 * fields, 45-space Records-array close, 49-space record brackets,
 * 53-space numbers).
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
 *     "prependP00Force":  2.2,             // optional — gets prepended as [force, 0.0]
 *     "appendP100Force":  714              // optional — gets appended as [force, 100.0]
 *   }
 *
 * Usage:
 *   node scripts/apply-pressure-backfill.mjs [path/to/edits.json] [--dry-run]
 *
 * Defaults to scripts/pressure-backfill-edits.json when no path is given.
 * With --dry-run, prints what it WOULD change without writing files.
 *
 * Per issue #212. After running, validate with `npm run data-quality`.
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const PR_DIR = path.join(ROOT, 'data-repo', 'data', 'pressure-response');

const args = process.argv.slice(2);
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

// --- PowerShell ConvertTo-Json number formatting -------------------------
//
// Matches scripts/add-pressure-session.mjs: round to `dp` decimal places,
// then either emit ".toString()" (preserves natural form like "167.3") or
// ".toFixed(1)" for integer-valued floats so they keep a `.0` suffix
// (e.g. "5.0" not "5", "100.0" not "100"). This matches how PowerShell's
// ConvertTo-Json serialises doubles, which the rest of the file uses.
function fmt(n, dp) {
	const v = +n.toFixed(dp);
	return Number.isInteger(v) ? v.toFixed(1) : v.toString();
}

const EOL = '\r\n';
const I45 = ' '.repeat(45); // Records-array closer
const I49 = ' '.repeat(49); // record `[` / `]`
const I53 = ' '.repeat(53); // numbers inside a record

/**
 * Build the record-block text for a single [force, pct] tuple, including
 * leading newline (so the inserter can drop it directly between existing
 * lines). The `terminator` is `'],'` for non-last and `']'` for last.
 */
function recordBlock(force, pct, terminator) {
	return (
		I49 + '[' + EOL + I53 + fmt(force, 1) + ',' + EOL + I53 + fmt(pct, 2) + EOL + I49 + terminator
	);
}

/**
 * Surgically apply prepend/append edits to a single session inside the
 * file text. Throws if the session's _id or Records structure can't be
 * located. Returns the new text.
 */
function applyEditToText(text, edit) {
	const idMarker = `"_id":  "${edit._id}"`;
	const idIdx = text.indexOf(idMarker);
	if (idIdx < 0) {
		throw new Error(`Session ${edit._id} not found in file`);
	}

	// Within the session block (which appears before `_id`), find the
	// `"Records":  [` opener immediately preceding this _id.
	const recordsOpener = `"Records":  [`;
	const recordsOpenerIdx = text.lastIndexOf(recordsOpener, idIdx);
	if (recordsOpenerIdx < 0) {
		throw new Error(`Records opener not found for ${edit._id}`);
	}

	// `<I45>],<EOL>` closes the Records array. It must lie between the
	// opener and _id; if not the file structure has drifted.
	const recordsCloseMarker = EOL + I45 + '],' + EOL;
	const recordsCloseIdx = text.indexOf(recordsCloseMarker, recordsOpenerIdx);
	if (recordsCloseIdx < 0 || recordsCloseIdx > idIdx) {
		throw new Error(`Records close not found for ${edit._id}`);
	}

	let out = text;

	// --- Append (force, 100): replace the existing last record's terminator
	// `<EOL><I49>]<EOL>` (note: no comma) with `<EOL><I49>],<EOL>` followed by
	// a new record block whose terminator IS `]` (since it becomes the new
	// last record). Locate the last-record closer by searching backward from
	// the array close (which scopes us to THIS session's Records block —
	// indexing from the start of the file would hit the first session's
	// Records on every iteration).
	if (typeof edit.appendP100Force === 'number') {
		const lastCloser = EOL + I49 + ']' + EOL;
		const lastCloserIdx = out.lastIndexOf(lastCloser, recordsCloseIdx);
		if (lastCloserIdx < 0 || lastCloserIdx < recordsOpenerIdx) {
			throw new Error(`Last-record closer not found for ${edit._id}`);
		}
		const newSection = EOL + I49 + '],' + EOL + recordBlock(edit.appendP100Force, 100, ']') + EOL;
		out = out.slice(0, lastCloserIdx) + newSection + out.slice(lastCloserIdx + lastCloser.length);
	}

	// --- Prepend (force, 0): insert a new record block directly after the
	// `"Records":  [<EOL>` opener for THIS session. We must scope to the
	// target session — `indexOf(opener)` from the start of the file would
	// inject into the first session's Records on every iteration. Use the
	// opener idx we already located (it's still valid: any append above ran
	// AFTER it and extended the file later than recordsOpenerIdx).
	if (typeof edit.prependP00Force === 'number') {
		const openerWithEol = recordsOpener + EOL;
		// Re-verify the opener is still at recordsOpenerIdx after any append;
		// the append only modifies bytes after this position so the offset
		// should be stable, but assert it to be safe.
		if (out.slice(recordsOpenerIdx, recordsOpenerIdx + openerWithEol.length) !== openerWithEol) {
			throw new Error(`Records opener shifted unexpectedly for ${edit._id}`);
		}
		const insertAt = recordsOpenerIdx + openerWithEol.length;
		const newSection = recordBlock(edit.prependP00Force, 0, '],') + EOL;
		out = out.slice(0, insertAt) + newSection + out.slice(insertAt);
	}

	return out;
}

// --- Group edits by brand and apply per file ------------------------------

const byBrand = new Map();
for (const e of edits) {
	if (!e._id || !e.brand) {
		console.error('Edit missing _id or brand:', e);
		process.exit(1);
	}
	if (e.prependP00Force === undefined && e.appendP100Force === undefined) {
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

	let text = fs.readFileSync(filePath, 'utf8');
	const origLen = text.length;

	console.log(`\n[${brand}] ${brandEdits.length} sessions`);
	for (const e of brandEdits) {
		const tag = `${e.inventoryId} ${e.date}`;
		try {
			text = applyEditToText(text, e);
			const parts = [];
			if (typeof e.prependP00Force === 'number') {
				parts.push(`P00=${fmt(e.prependP00Force, 1)}`);
				totalPrepend++;
			}
			if (typeof e.appendP100Force === 'number') {
				parts.push(`P100=${fmt(e.appendP100Force, 1)}`);
				totalAppend++;
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
			`(+${text.length - origLen} bytes)`,
	);
	if (!dryRun) fs.writeFileSync(filePath, text);
}

console.log(
	`\nApplied ${totalApplied} edits (${totalPrepend} P00 prepends, ${totalAppend} P100 appends).`,
);
if (dryRun) console.log('Dry-run only — no files written.');
else console.log(`Now run \`npm run data-quality\` to validate.`);
