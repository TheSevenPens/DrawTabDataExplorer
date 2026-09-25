#!/usr/bin/env -S npx tsx
/**
 * Import direct pressure-range endpoint measurements (IAF / MAX) into the
 * brand-sharded `data-repo/data/pressure-range/<BRAND>-pressure-range.json`
 * files. Each file is read, the new records are pushed onto its
 * PressureRange array (or the file is created), and it is written back
 * through the shared validated transaction, along with refreshed metadata.
 * On an already-canonical file the diff is just the new records.
 *
 * These are *direct measurements* from an external tool — distinct from the
 * *estimated* Piaf/Pmax derived from pressure-response curves.
 *
 * --- Input ---
 * A JSON file: an array (or { measurements: [...] }) of rows. Each row:
 *   {
 *     "Date":           "2026-06-16",        // required, YYYY-MM-DD
 *     "PenInventoryId": "WAP.0001",          // required, physical unit
 *     "IAF":            2.1,                  // value when Metric=IAF
 *     // ...or "MAX": 712  ...or explicit "Metric"+"Value"
 *     "TabletEntityId": "wacom.tablet.…",    // tested-on tablet
 *     "Driver":         "WACOM 6.4.13-2",
 *     "OS":             "WINDOWS",
 *     "Method":         "<tool / method>"
 *   }
 *
 * Brand and PenEntityId are derived from the inventory record matched by
 * PenInventoryId (data-repo/data/inventory/sevenpens-pens.json).
 *
 * --- Usage ---
 * Run with tsx — the script imports a .ts module:
 *   npx tsx scripts/add-pressure-range.mjs path/to/measurements.json [--dry-run]
 *
 * --data-dir <dir> reads and writes <dir> instead of data-repo/data (for
 * testing against a copy).
 *
 * Validation runs before committing the entire batch.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readDataJson } from '../data-repo/lib/data-json.ts';

import { commitDatasetUpdate } from '../data-repo/lib/update-dataset.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

// --- CLI ---

const args = process.argv.slice(2);
const dataDirAt = args.indexOf('--data-dir');
const dataDirArg = dataDirAt >= 0 ? args.splice(dataDirAt, 2)[1] : undefined;
const dryRun = args.includes('--dry-run');
const inputArg = args.find((a) => !a.startsWith('--'));
if (!inputArg || (dataDirAt >= 0 && !dataDirArg)) {
	console.log(
		'Usage: npx tsx scripts/add-pressure-range.mjs <measurements.json> [--dry-run] [--data-dir <dir>]',
	);
	process.exit(args.length === 0 ? 1 : 0);
}

const DATA_DIR = dataDirArg ? path.resolve(dataDirArg) : path.join(ROOT, 'data-repo', 'data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory', 'sevenpens-pens.json');
const PR_DIR = path.join(DATA_DIR, 'pressure-range');
const inputPath = path.resolve(inputArg);

// --- Load + normalise input rows ---

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const rows = Array.isArray(raw) ? raw : raw.measurements;
if (!Array.isArray(rows) || rows.length === 0) {
	console.error(
		`No measurement rows in ${inputPath} (expected an array or { measurements: [...] }).`,
	);
	process.exit(1);
}

const inventory = readDataJson(INVENTORY_FILE).InventoryPens;
const invById = new Map(inventory.map((p) => [p.InventoryId, p]));

// Value is stored as a numeric string (schema: NumericString), in the
// number's plain form — no `.0` padding for integers.
const fmtVal = (n) => {
	const v = typeof n === 'number' ? n : Number(n);
	if (!Number.isFinite(v)) throw new Error(`Non-numeric value: ${n}`);
	return String(v);
};

const records = rows.map((r, i) => {
	const where = `row ${i + 1}`;
	const penInventoryId = r.PenInventoryId ?? r.InventoryId;
	if (!penInventoryId) throw new Error(`${where}: missing PenInventoryId`);
	if (!r.Date) throw new Error(`${where}: missing Date`);

	let metric, value;
	if (r.IAF != null) {
		metric = 'IAF';
		value = r.IAF;
	} else if (r.MAX != null) {
		metric = 'MAX';
		value = r.MAX;
	} else {
		metric = r.Metric;
		value = r.Value;
	}
	if (metric !== 'IAF' && metric !== 'MAX')
		throw new Error(`${where}: Metric must be IAF or MAX (got ${metric})`);
	if (value == null) throw new Error(`${where}: missing value for ${metric}`);

	const inv = invById.get(penInventoryId);
	if (!inv)
		throw new Error(
			`${where}: PenInventoryId "${penInventoryId}" not found in ${path.relative(ROOT, INVENTORY_FILE)}`,
		);

	const isoNow = new Date(`${r.Date}T00:00:00.000Z`).toISOString();
	return {
		Brand: inv.Brand,
		PenEntityId: inv.PenEntityId,
		PenInventoryId: penInventoryId,
		Metric: metric,
		Value: fmtVal(value),
		Date: r.Date,
		TabletEntityId: r.TabletEntityId ?? '',
		Driver: r.Driver ?? '',
		OS: r.OS ?? '',
		Method: r.Method ?? '',
		_id: crypto.randomUUID(),
		_CreateDate: isoNow,
		_ModifiedDate: isoNow,
	};
});

// --- Group by brand, create-or-append each file ---

const byBrand = new Map();
for (const rec of records) {
	if (!byBrand.has(rec.Brand)) byBrand.set(rec.Brand, []);
	byBrand.get(rec.Brand).push(rec);
}

let totalWritten = 0;
const dataFiles = new Map();
for (const [brand, recs] of byBrand) {
	const filePath = path.join(PR_DIR, `${brand}-pressure-range.json`);
	const exists = fs.existsSync(filePath);

	// Existing file: append to its PressureRange array. New file: create it.
	const doc = exists ? readDataJson(filePath) : { PressureRange: [] };
	if (!Array.isArray(doc.PressureRange)) {
		console.error(`No PressureRange array in ${filePath}.`);
		process.exit(1);
	}
	doc.PressureRange.push(...recs);

	if (dryRun) {
		console.log(
			`[dry-run] ${exists ? 'append to' : 'create'} ${path.relative(ROOT, filePath)} (+${recs.length})`,
		);
	} else {
		// Commit all brands together after validation below.
		console.log(
			`${exists ? 'Planned append to' : 'Planned creation of'} ${path.relative(ROOT, filePath)} (+${recs.length})`,
		);
	}
	dataFiles.set('data/pressure-range/' + brand + '-pressure-range.json', doc);
	totalWritten += recs.length;
}

commitDatasetUpdate(path.dirname(DATA_DIR), [], { dataFiles, dryRun });

console.log(
	`\n${dryRun ? 'Would import' : 'Imported'} ${totalWritten} measurement(s) across ${byBrand.size} brand file(s).`,
);
if (!dryRun) console.log('Run `npm run data-quality` to validate.');
