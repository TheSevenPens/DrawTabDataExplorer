#!/usr/bin/env node
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
 * A new record is appended at the end of the brand's
 * pressure-response.json file in the legacy PowerShell wide-indent
 * format used throughout the data-repo (29-space indent for record
 * braces, 33-space for fields, 49-space for tuple brackets, 53-space
 * for numbers — see existing records for reference).
 *
 * Number formatting matches the rest of the file: physicalGf rounded
 * to 1dp, logicalNorm * 100 rounded to 2dp, integer-valued floats keep
 * a `.0` suffix (e.g. `5.0` not `5`) to match PowerShell ConvertTo-Json.
 *
 * --- Usage ---
 *   node scripts/add-pressure-session.mjs path/to/2026-05-24-WAP.0047.json
 *   node scripts/add-pressure-session.mjs <file> \
 *       --tablet wacom.tablet.pth860 \
 *       --user SEVEN \
 *       --driver WACOM \
 *       --os WINDOWS \
 *       --notes "something to remember"
 *
 * Run `npm run data-quality` afterwards (the script doesn't do this
 * automatically — leaves room to batch multiple inserts before validating).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'data-repo', 'data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory', 'sevenpens-pens.json');
const PENS_DIR = path.join(DATA_DIR, 'pens');
const PR_DIR = path.join(DATA_DIR, 'pressure-response');

// --- CLI parsing ---

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
	console.log(
		'Usage: node scripts/add-pressure-session.mjs <file.json> [--tablet …] [--user …] [--driver …] [--os …] [--notes …]',
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

// --- Filename parse ---

const filename = path.basename(inputPath);
// Match <YYYY-MM-DD>-<InventoryId>.json
const m = /^(\d{4}-\d{2}-\d{2})-(.+)\.json$/i.exec(filename);
if (!m) {
	console.error(
		`Filename "${filename}" doesn't match <YYYY-MM-DD>-<InventoryId>.json pattern.`,
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

const inventory = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8')).InventoryPens;
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
const brandPens = JSON.parse(fs.readFileSync(brandPensPath, 'utf8')).Pens;
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
const prText = fs.readFileSync(prPath, 'utf8');
const prJson = JSON.parse(prText);

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

// --- Build records (force 1dp, logical*100 2dp, preserve .0 for ints) ---

const fmt = (n, dp) => {
	const v = +n.toFixed(dp);
	return Number.isInteger(v) ? v.toFixed(1) : v.toString();
};
const recs = src.captures.map((c) => [fmt(c.physicalGf, 1), fmt(c.logicalNorm * 100, 2)]);

// --- Render new record block in PowerShell wide-indent style ---

const EOL = '\r\n';
const I25 = ' '.repeat(25);
const I29 = ' '.repeat(29);
const I33 = ' '.repeat(33);
const I45 = ' '.repeat(45);
const I49 = ' '.repeat(49);
const I53 = ' '.repeat(53);

const recLines = recs
	.map((r, i) => {
		const tail = i === recs.length - 1 ? ']' : '],';
		return I49 + '[' + EOL + I53 + r[0] + ',' + EOL + I53 + r[1] + EOL + I49 + tail;
	})
	.join(EOL);

const uuid = crypto.randomUUID();
const isoNow = new Date(date + 'T00:00:00.000Z').toISOString();

const block =
	I29 + '{' + EOL +
	I33 + '"Brand":  "' + brand + '",' + EOL +
	I33 + '"PenFamily":  "' + penFamily + '",' + EOL +
	I33 + '"InventoryId":  "' + inventoryId + '",' + EOL +
	I33 + '"Date":  "' + date + '",' + EOL +
	I33 + '"User":  "' + user + '",' + EOL +
	I33 + '"Driver":  "' + driver + '",' + EOL +
	I33 + '"OS":  "' + os + '",' + EOL +
	I33 + '"Notes":  "' + notes.replace(/"/g, '\\"') + '",' + EOL +
	I33 + '"Records":  [' + EOL +
	recLines + EOL +
	I45 + '],' + EOL +
	I33 + '"_id":  "' + uuid + '",' + EOL +
	I33 + '"_CreateDate":  "' + isoNow + '",' + EOL +
	I33 + '"_ModifiedDate":  "' + isoNow + '",' + EOL +
	I33 + '"PenEntityId":  "' + penEntityId + '",' + EOL +
	I33 + '"TabletEntityId":  "' + tabletEntityId + '"' + EOL +
	I29 + '}';

// --- Inject before the closing `]\n}` of the PressureResponse array ---
//
// Locate the array's tail by searching for the very last `\n` + 25-space
// indent + `]\n}` which closes the array and the root object. The new
// block goes right before that, with a leading `,\r\n` to extend the
// previous-final record's terminator.

const tailMarker = EOL + I25 + ']' + EOL + '}';
const tailIdx = prText.lastIndexOf(tailMarker);
if (tailIdx < 0) {
	console.error(
		`Could not find PressureResponse array tail in ${prPath}. ` +
			`Expected "\\r\\n${I25}]\\r\\n}" near EOF — file format may have drifted.`,
	);
	process.exit(1);
}

// The character right before tailMarker is the closing `}` of the last
// record (no trailing comma). We need to insert `,\r\n<block>` between
// that `}` and `\r\n<25sp>]\r\n}`.
const newText = prText.slice(0, tailIdx) + ',' + EOL + block + prText.slice(tailIdx);

fs.writeFileSync(prPath, newText);

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
