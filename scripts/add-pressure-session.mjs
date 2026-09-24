#!/usr/bin/env -S npx tsx
/**
 * Append a pressure-response session to the right brand-specific
 * pressure-response JSON file in the data-repo.
 *
 * --- Input ---
 * JSON file from the capture tool with shape:
 *   { captures: [{ count, physicalGf, logicalNorm, penSamples (ignored),
 *                  scaleSamples (ignored) }, ...] }
 *
 * Filename convention: <YYYY-MM-DD>-<InventoryId>.json
 *   e.g. 2026-05-24-WAP.0047.json  → date=2026-05-24, InventoryId=WAP.0047
 *
 * --- Derived fields ---
 *   Brand, PenEntityId   inventory pen record (InventoryId match)
 *   PenFamily            pen record (PenEntityId match)
 *   User, Driver, OS,    most recent prior session for this InventoryId;
 *   TabletEntityId       override via CLI flags
 *
 * --- Output ---
 * A new record is appended to the PressureResponse array of the brand's
 * pressure-response.json file: read → push → written back through
 * writeDataJson (data-repo/lib/data-json.ts), the dataset's one canonical
 * JSON writer (2-space indent, LF, UTF-8 without BOM; RFC #45). On an
 * already-canonical file the diff is just the new record.
 *
 * Records are [physicalGf rounded to 1dp, logicalNorm * 100 rounded to
 * 2dp], stored as plain JSON numbers.
 *
 * --- Usage ---
 * Run with tsx — the script imports a .ts module:
 *   npx tsx scripts/add-pressure-session.mjs path/to/2026-05-24-WAP.0047.json
 *   npx tsx scripts/add-pressure-session.mjs <file> \
 *       --tablet wacom.tablet.pth860 \
 *       --user SEVEN \
 *       --driver WACOM \
 *       --os WINDOWS \
 *       --notes "something to remember"
 *
 * --data-dir <dir> reads and writes <dir> instead of data-repo/data (for
 * testing against a copy).
 *
 * Run `npm run data-quality` afterwards (the script doesn't do this
 * automatically — leaves room to batch multiple inserts before validating).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readDataJson, writeDataJson } from '../data-repo/lib/data-json.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

// --- CLI parsing ---

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
	console.log(
		'Usage: npx tsx scripts/add-pressure-session.mjs <file.json> [--tablet …] [--user …] [--driver …] [--os …] [--notes …] [--data-dir …]',
	);
	process.exit(args.length === 0 ? 1 : 0);
}

const inputPath = path.resolve(args[0]);
const overrides = {};
for (let i = 1; i < args.length; i += 2) {
	const flag = args[i];
	const val = args[i + 1];
	if (!flag.startsWith('--') || val === undefined) {
		console.error(`Bad argument near "${flag}". Expected --flag value pairs after the input path.`);
		process.exit(1);
	}
	overrides[flag.slice(2)] = val;
}

const DATA_DIR = overrides['data-dir']
	? path.resolve(overrides['data-dir'])
	: path.join(ROOT, 'data-repo', 'data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory', 'sevenpens-pens.json');
const PENS_DIR = path.join(DATA_DIR, 'pens');
const PR_DIR = path.join(DATA_DIR, 'pressure-response');

// --- Filename parse ---

const filename = path.basename(inputPath);
// Match <YYYY-MM-DD>{-or-.}<InventoryId>.json — the separator can be a
// hyphen (e.g. 2026-05-25-WAP.0009.json) or a dot (2026-05-25.WAP.0009.json),
// since real capture filenames have shown up with both.
const m = /^(\d{4}-\d{2}-\d{2})[-.](.+)\.json$/i.exec(filename);
if (!m) {
	console.error(
		`Filename "${filename}" doesn't match <YYYY-MM-DD>{-|.}<InventoryId>.json pattern.`,
	);
	process.exit(1);
}
const date = m[1];
const inventoryId = m[2];

// --- Load source captures ---

const src = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
if (!Array.isArray(src.captures) || src.captures.length === 0) {
	console.error(`No captures in ${inputPath}`);
	process.exit(1);
}

// --- Resolve pen / brand from inventory ---

const inventory = readDataJson(INVENTORY_FILE).InventoryPens;
const invPen = inventory.find((p) => p.InventoryId === inventoryId);
if (!invPen) {
	console.error(`InventoryId "${inventoryId}" not found in ${INVENTORY_FILE}.`);
	process.exit(1);
}
const brand = invPen.Brand;
const penEntityId = invPen.PenEntityId;

// --- Resolve PenFamily from pen record ---

const brandPensPath = path.join(PENS_DIR, `${brand}-pens.json`);
if (!fs.existsSync(brandPensPath)) {
	console.error(`Pens file not found: ${brandPensPath}`);
	process.exit(1);
}
const brandPens = readDataJson(brandPensPath).Pens;
const pen = brandPens.find((p) => p.EntityId === penEntityId);
if (!pen) {
	console.error(`Pen "${penEntityId}" not found in ${brandPensPath}`);
	process.exit(1);
}
const penFamily = pen.PenFamily ?? '';

// --- Load destination pressure-response file ---

const prPath = path.join(PR_DIR, `${brand}-pressure-response.json`);
if (!fs.existsSync(prPath)) {
	console.error(`Pressure-response file not found: ${prPath}`);
	process.exit(1);
}
const prJson = readDataJson(prPath);

// --- Defaults from the most recent prior session for this unit ---

const priorSessions = prJson.PressureResponse.filter((s) => s.InventoryId === inventoryId);
priorSessions.sort((a, b) => (a.Date < b.Date ? 1 : -1));
const prior = priorSessions[0];

const user = overrides.user ?? prior?.User ?? 'sevenpens';
const driver = overrides.driver ?? prior?.Driver ?? brand;
const os = overrides.os ?? prior?.OS ?? 'WINDOWS';
const tabletEntityId = overrides.tablet ?? prior?.TabletEntityId;
if (!tabletEntityId) {
	console.error(
		`No TabletEntityId provided and no prior session for ${inventoryId} to default from.\n` +
			`Pass --tablet <wacom.tablet.…>`,
	);
	process.exit(1);
}
const notes = overrides.notes ?? '';

// --- Build the record ---
//
// physicalGf rounded to 1dp, logicalNorm * 100 rounded to 2dp, stored as
// plain JSON numbers (the canonical writer prints them in shortest form).

const round = (n, dp) => +n.toFixed(dp);
const recs = src.captures.map((c) => [round(c.physicalGf, 1), round(c.logicalNorm * 100, 2)]);

const uuid = crypto.randomUUID();
const isoNow = new Date(date + 'T00:00:00.000Z').toISOString();

// Key order matches the existing session records.
prJson.PressureResponse.push({
	Brand: brand,
	PenFamily: penFamily,
	InventoryId: inventoryId,
	Date: date,
	User: user,
	Driver: driver,
	OS: os,
	Notes: notes,
	Records: recs,
	_id: uuid,
	_CreateDate: isoNow,
	_ModifiedDate: isoNow,
	PenEntityId: penEntityId,
	TabletEntityId: tabletEntityId,
});

writeDataJson(prPath, prJson);

console.log(`Added session for ${inventoryId} (${date}):`);
console.log(`  pen     : ${penEntityId}`);
console.log(`  family  : ${penFamily || '(none)'}`);
console.log(`  tablet  : ${tabletEntityId}`);
console.log(`  driver  : ${driver}`);
console.log(`  os      : ${os}`);
console.log(`  user    : ${user}`);
console.log(`  records : ${recs.length}`);
console.log(`  uuid    : ${uuid}`);
console.log(`  → ${path.relative(ROOT, prPath)}`);
console.log(`\nRun \`npm run data-quality\` to validate.`);
