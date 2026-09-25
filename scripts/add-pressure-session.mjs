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
 * A new session source file, data-repo/source/pressure-response/<brand>/
 * <EntityId>.json (sessions are authored one per file, RFC #45 phase 5),
 * written with writeSourceRecord; then the brand bundles under
 * data/pressure-response/ are regenerated. The diff is the new file plus
 * the same record in its bundle.
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
 *       --notes "something to remember" \
 *       --id-suffix galaxybook5pro360
 *
 * EntityId is stored on the session (see data-repo/lib/pressure/session-id.ts):
 * <brand>.session.<inventoryid>_<date>. A second session of the same pen on
 * the same day gets IdSuffix = the tablet's model segment (e.g.
 * "_galaxybook5pro360"); if that is taken too, pass --id-suffix.
 *
 * --repo-root <dir> reads and writes that data-repo copy (holding source/
 * and data/) instead of data-repo/ (for testing).
 *
 * Run `npm run data-quality` afterwards (the script doesn't do this
 * automatically — leaves room to batch multiple inserts before validating).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readDataJson } from '../data-repo/lib/data-json.ts';
import { deriveSessionEntityId } from '../data-repo/lib/pressure/session-id.ts';
import {
	readSources,
	regenerate,
	sourceCollection,
	writeSourceRecord,
} from '../data-repo/lib/sources.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

// --- CLI parsing ---

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
	console.log(
		'Usage: npx tsx scripts/add-pressure-session.mjs <file.json> [--tablet …] [--user …] [--driver …] [--os …] [--notes …] [--id-suffix …] [--repo-root …]',
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

const REPO_ROOT = overrides['repo-root']
	? path.resolve(overrides['repo-root'])
	: path.join(ROOT, 'data-repo');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory', 'sevenpens-pens.json');
const PENS_DIR = path.join(DATA_DIR, 'pens');

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

// --- Load the existing sessions (their sources are the editable copy) ---

const sessions = sourceCollection('pressure-response');
const { records: existing, issues } = readSources(REPO_ROOT, sessions);
if (issues.length) {
	console.error('Session source problems (fix these first; nothing was written):');
	for (const i of issues) console.error(`  ${i.file}: ${i.problem}`);
	process.exit(1);
}
const brandSessions = existing.filter((r) => r.brand === brand).map((r) => r.record);

// --- Defaults from the most recent prior session for this unit ---

const priorSessions = brandSessions.filter((s) => s.InventoryId === inventoryId);
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

// --- EntityId: derived, with an IdSuffix for a same-day repeat ---

const takenIds = new Set(brandSessions.map((s) => s.EntityId));
const identity = { Brand: brand, InventoryId: inventoryId, Date: date };
let idSuffix = overrides['id-suffix'];
const sameDay = brandSessions.filter((s) => s.InventoryId === inventoryId && s.Date === date);
if (!idSuffix && sameDay.length > 0) {
	// Same pen, same day, same tablet is far more likely a re-run of this
	// script than a real second session — refuse unless told otherwise.
	if (sameDay.some((s) => s.TabletEntityId === tabletEntityId)) {
		console.error(
			`${inventoryId} already has a session on ${date} on ${tabletEntityId} ` +
				`(${sameDay.map((s) => s.EntityId).join(', ')}).\n` +
				'If this is a genuine second session, pass --id-suffix <something unique>.',
		);
		process.exit(1);
	}
	idSuffix = tabletEntityId.split('.').pop();
}
const entityId = deriveSessionEntityId({ ...identity, IdSuffix: idSuffix });
if (takenIds.has(entityId)) {
	console.error(
		`${entityId} already exists: ${inventoryId} was already measured on ${date}` +
			(idSuffix ? ` with IdSuffix "${idSuffix}"` : '') +
			'.\nPass --id-suffix <something unique> to record another session.',
	);
	process.exit(1);
}

const uuid = crypto.randomUUID();
const isoNow = new Date(date + 'T00:00:00.000Z').toISOString();

// Key order matches the existing session records.
const sourceRel = writeSourceRecord(REPO_ROOT, sessions, {
	EntityId: entityId,
	Brand: brand,
	PenFamily: penFamily,
	InventoryId: inventoryId,
	Date: date,
	...(idSuffix ? { IdSuffix: idSuffix } : {}),
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

const regenerated = regenerate(REPO_ROOT);

console.log(`Added session for ${inventoryId} (${date}):`);
console.log(`  id      : ${entityId}`);
console.log(`  pen     : ${penEntityId}`);
console.log(`  family  : ${penFamily || '(none)'}`);
console.log(`  tablet  : ${tabletEntityId}`);
console.log(`  driver  : ${driver}`);
console.log(`  os      : ${os}`);
console.log(`  user    : ${user}`);
console.log(`  records : ${recs.length}`);
console.log(`  uuid    : ${uuid}`);
console.log(`  → ${sourceRel}`);
for (const f of regenerated) console.log(`  regenerated ${f}`);
console.log(`\nRun \`npm run data-quality\` to validate.`);
