#!/usr/bin/env node
/**
 * Import direct pressure-range endpoint measurements (IAF / MAX) into the
 * brand-sharded `data-repo/data/pressure-range/<BRAND>-pressure-range.json`
 * files, in the legacy PowerShell wide-indent format used throughout the
 * data-repo (records at 29-space indent, fields at 33-space, array close at
 * 25-space — see existing pressure-response files for reference).
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
 *   node scripts/add-pressure-range.mjs path/to/measurements.json [--dry-run]
 *
 * Run `npm run data-quality` afterwards to validate.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'data-repo', 'data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory', 'sevenpens-pens.json');
const PR_DIR = path.join(DATA_DIR, 'pressure-range');

// --- CLI ---

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputArg = args.find((a) => !a.startsWith('--'));
if (!inputArg) {
	console.log('Usage: node scripts/add-pressure-range.mjs <measurements.json> [--dry-run]');
	process.exit(args.length === 0 ? 1 : 0);
}
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

const inventory = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8')).InventoryPens;
const invById = new Map(inventory.map((p) => [p.InventoryId, p]));

// Numeric value → string, preserving a `.0` on integers to match the
// PowerShell-formatted numeric strings elsewhere in the dataset.
const fmtVal = (n) => {
	const v = typeof n === 'number' ? n : Number(n);
	if (!Number.isFinite(v)) throw new Error(`Non-numeric value: ${n}`);
	return Number.isInteger(v) ? v.toFixed(1) : String(v);
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

// --- Wide-indent rendering ---

const EOL = '\r\n';
const I4 = ' '.repeat(4);
const I25 = ' '.repeat(25);
const I29 = ' '.repeat(29);
const I33 = ' '.repeat(33);

const FIELD_ORDER = [
	'Brand',
	'PenEntityId',
	'PenInventoryId',
	'Metric',
	'Value',
	'Date',
	'TabletEntityId',
	'Driver',
	'OS',
	'Method',
	'_id',
	'_CreateDate',
	'_ModifiedDate',
];

function renderRecord(rec, isLast) {
	const body = FIELD_ORDER.map((k, i) => {
		const comma = i === FIELD_ORDER.length - 1 ? '' : ',';
		const val = String(rec[k]).replace(/"/g, '\\"');
		return `${I33}"${k}":  "${val}"${comma}`;
	}).join(EOL);
	return `${I29}{${EOL}${body}${EOL}${I29}}${isLast ? '' : ','}`;
}

// --- Group by brand, create-or-append each file ---

const byBrand = new Map();
for (const rec of records) {
	if (!byBrand.has(rec.Brand)) byBrand.set(rec.Brand, []);
	byBrand.get(rec.Brand).push(rec);
}

let totalWritten = 0;
for (const [brand, recs] of byBrand) {
	const filePath = path.join(PR_DIR, `${brand}-pressure-range.json`);
	const exists = fs.existsSync(filePath);

	let newText;
	if (exists) {
		// Append before the array tail, extending the prior last record's
		// terminator with a comma (same splice scheme as add-pressure-session).
		const text = fs.readFileSync(filePath, 'utf8');
		const tailMarker = `${EOL}${I25}]${EOL}}`;
		const tailIdx = text.lastIndexOf(tailMarker);
		if (tailIdx < 0) {
			console.error(`Could not find array tail in ${filePath}; format may have drifted.`);
			process.exit(1);
		}
		const blocks = recs.map((r, i) => renderRecord(r, i === recs.length - 1)).join(EOL);
		newText = `${text.slice(0, tailIdx)},${EOL}${blocks}${text.slice(tailIdx)}`;
	} else {
		const blocks = recs.map((r, i) => renderRecord(r, i === recs.length - 1)).join(EOL);
		newText = `{${EOL}${I4}"PressureRange":  [${EOL}${blocks}${EOL}${I25}]${EOL}}${EOL}`;
	}

	if (dryRun) {
		console.log(
			`[dry-run] ${exists ? 'append to' : 'create'} ${path.relative(ROOT, filePath)} (+${recs.length})`,
		);
	} else {
		if (!fs.existsSync(PR_DIR)) fs.mkdirSync(PR_DIR, { recursive: true });
		fs.writeFileSync(filePath, newText);
		console.log(
			`${exists ? 'Appended to' : 'Created'} ${path.relative(ROOT, filePath)} (+${recs.length})`,
		);
	}
	totalWritten += recs.length;
}

console.log(
	`\n${dryRun ? 'Would import' : 'Imported'} ${totalWritten} measurement(s) across ${byBrand.size} brand file(s).`,
);
if (!dryRun) console.log('Run `npm run data-quality` to validate.');
