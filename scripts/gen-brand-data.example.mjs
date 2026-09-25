// Template for bulk-generating tablet / pen / tablet-family / pen-compat
// JSON for a new brand. Adapted from the script used to add Apple iPads
// (35 tablets, 4 families, 4 pen-compat groups) — see CLAUDE.md
// "Adding a new brand" for the full checklist.
//
// Why a generator script and not hand-written JSON?
//   - UUIDs are auto-generated (no copy/paste collisions)
//   - Display.Dimensions is derived from diagonal + pixel aspect
//   - Meta.EntityId is derived from Brand + Model.Id consistently
//   - Adding a new tablet = one entry in the array, not 30 lines of JSON
//   - Everything is written in the dataset's one canonical JSON form
//     (2-space indent, LF, UTF-8 without BOM; RFC #45), so it can land in
//     data-repo/ as-is
//
// Where things go (RFC #45):
//   - Tablets and pens are authored one record per file:
//     source/tablets/<brand>/<EntityId>.json, source/pens/<brand>/<EntityId>.json
//     via commitDatasetUpdate. The brand bundles data/tablets/<BRAND>-tablets.json
//     and data/pens/<BRAND>-pens.json are GENERATED from them by
//     the shared transaction — never write a bundle directly (CI's `generate --check`
//     fails on one that differs from its sources).
//   - Families and pen-compat join the same transaction as grouped dataFiles.
//
// Usage:
//   1. Copy this file within scripts/, e.g. cp gen-brand-data.example.mjs gen-foobar.mjs
//      (the data-repo imports below are relative to scripts/)
//   2. Edit BRAND, the TABLETS and PENS arrays, FAMILIES, and PEN_COMPAT
//   3. Preview: npx tsx scripts/gen-foobar.mjs   (tsx, not node — it imports .ts modules)
//      writes a scratch tree under <os tmpdir>/gen-brand-output
//   4. When ready: npx tsx scripts/gen-foobar.mjs --repo-root data-repo
//   5. npx tsx data-repo/lib/run-data-quality.ts

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commitDatasetUpdate } from '../data-repo/lib/update-dataset.ts';
import { sourceCollection } from '../data-repo/lib/sources.ts';

// --- Customize ---

const BRAND = 'FOOBAR'; // must already be in BrandEnum (schemas.ts)
const TODAY = new Date().toISOString();
// The data-repo root (the directory holding source/ and data/). Defaults to
// a scratch tree; pass --repo-root data-repo to write the real thing.
const rootArg = process.argv.indexOf('--repo-root');
const REPO_ROOT = path.resolve(
	rootArg >= 0 ? process.argv[rootArg + 1] : path.join(os.tmpdir(), 'gen-brand-output'),
);

// --- Helpers ---

/** Derive display physical dimensions (mm) from diagonal (inches) +
 *  pixel aspect. Pixels are square on every modern display, so the
 *  pixel aspect equals the physical aspect. */
function physDim(diagInches, pxW, pxH) {
	const diagMm = diagInches * 25.4;
	const aspect = pxW / pxH;
	const h = diagMm / Math.sqrt(aspect * aspect + 1);
	const w = aspect * h;
	return { Width: Math.round(w * 10) / 10, Height: Math.round(h * 10) / 10 };
}

/** Replicates the EntityId derivation rule enforced by data-quality.ts:
 *  brand.toLowerCase() + ".tablet." + id-with-non-alphanumerics-stripped. */
function deriveTabletEntityId(brand, modelId) {
	return brand.toLowerCase() + '.tablet.' + modelId.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

// --- Tablets ---
//
// Each entry feeds buildTablet() below. Set `null` (or omit) for any
// optional Display / Standalone field you don't have a value for —
// don't invent values just to fill the field. Better to leave fields
// blank than to ship unvalidated guesses.

const TABLETS = [
	{
		id: 'FB-100', // Model.Id (free-form; alphanumerics survive into EntityId)
		name: 'Foobar Tab 10', // Model.Name (display label)
		type: 'STANDALONE', // PENTABLET | PENDISPLAY | STANDALONE
		year: '2025',
		audience: 'Consumer', // Consumer | Enthusiast | Professional
		family: 'foobar.tabletfamily.fbtabseries', // EntityId of a row in TabletFamilies (NOT a display name)
		status: 'ACTIVE', // ACTIVE | AVAILABLE | DISCONTINUED
		productLink: 'https://example.com/fb100',

		// Digitizer
		digitizerType: null, // PASSIVE_EMR | ACTIVE_EMR | null (e.g. capacitive-with-active-stylus)
		pressureLevels: '8192', // string of an integer, or null if unpublished
		supportsTouch: 'YES', // YES | NO
		tilt: '60', // tilt-angle range in degrees (NumericString) — NOT YES/NO

		// Display (omit panelTech etc. if Type === "PENTABLET")
		diag: 10.9, // diagonal inches — used to compute Display.Dimensions
		pxW: 2360,
		pxH: 1640, // pixel resolution
		panelTech: 'IPS', // IPS | TFT | AHVA | OLED | H-IPS | MVA
		refreshRate: '60',
		lamination: 'YES', // YES | NO
		antiGlare: null, // AGFILM | ETCHEDGLASS | FILM | null

		// Physical (the device, not the display area)
		physW: 248.6,
		physH: 179.5,
		physD: 7.0, // mm
		weight: '477', // grams (NumericString)

		// Standalone (only when Type === "STANDALONE")
		os: 'FoobarOS 1.0',
		processor: 'Foobar X1',
		usb: 'USB-C',
		speakers: 'YES',
	},
	// ... add more tablets here
];

// --- Pens ---
//
// One entry per pen. EntityId is derived as brand.pen.<penid> (lowercase,
// alphanumerics only), matching find-or-add-pen.ts and the data-quality check.

const PENS = [
	{
		id: 'FBSTYLUS1', // PenId
		name: 'Foobar Stylus', // PenName
		family: '', // pen-family EntityId, or '' if none yet
		year: '2025',
	},
	// ... add more pens here
];

// --- Tablet families ---

const FAMILIES = [
	{ entityId: 'foobar.tabletfamily.fbtabseries', name: 'Foobar Tab series' },
	// ... etc.
];

// --- Pen-compat (one row per pen, listing tablet Model.Id values) ---
//
// PenId / TabletIds use bare Model.Id strings (NOT full EntityIds),
// matching the convention in WACOM-pen-compat.json etc.

const PEN_COMPAT = [
	{ penId: 'FBSTYLUS1', tabletIds: ['FB-100'] },
	// ... etc.
];

// --- Build records ---

function buildTablet(t) {
	const eid = deriveTabletEntityId(BRAND, t.id);

	const digitizer = {};
	if (t.digitizerType) digitizer.Type = t.digitizerType;
	if (t.pressureLevels) digitizer.PressureLevels = t.pressureLevels;
	if (t.diag && t.pxW && t.pxH) digitizer.Dimensions = physDim(t.diag, t.pxW, t.pxH);
	if (t.tilt) digitizer.Tilt = t.tilt;
	if (t.supportsTouch) digitizer.SupportsTouch = t.supportsTouch;

	const record = {
		Meta: {
			EntityId: eid,
			_id: randomUUID(),
			_CreateDate: TODAY,
			_ModifiedDate: TODAY,
		},
		Model: {
			Brand: BRAND,
			Id: t.id,
			Name: t.name,
			Type: t.type,
			ReleaseYear: t.year,
			...(t.audience ? { Audience: t.audience } : {}),
			...(t.family ? { Family: t.family } : {}),
			...(t.status ? { Status: t.status } : {}),
			// The manufacturer product page lives in Links as the single
			// MANUFACTURERPRODUCTINFO entry (read via tabletManufacturerProductLink);
			// there is no standalone ProductLink field anymore. Author should be the
			// brand *display* name (e.g. "Wacom") — BRAND here is the enum code.
			...(t.productLink
				? { Links: [{ Type: 'MANUFACTURERPRODUCTINFO', URL: t.productLink, Author: BRAND }] }
				: {}),
		},
		...(Object.keys(digitizer).length ? { Digitizer: digitizer } : {}),
	};

	// Display group: only on PENDISPLAY and STANDALONE (schema enforces this).
	if (t.type !== 'PENTABLET' && (t.pxW || t.panelTech)) {
		record.Display = {
			...(t.pxW && t.pxH ? { PixelDimensions: { Width: t.pxW, Height: t.pxH } } : {}),
			...(t.panelTech ? { PanelTech: t.panelTech } : {}),
			...(t.lamination ? { Lamination: t.lamination } : {}),
			...(t.antiGlare ? { AntiGlare: t.antiGlare } : {}),
			...(t.refreshRate ? { RefreshRate: t.refreshRate } : {}),
		};
	}

	if (t.physW || t.physH || t.physD || t.weight) {
		record.Physical = {
			...(t.physW || t.physH || t.physD
				? { Dimensions: { Width: t.physW, Height: t.physH, Depth: t.physD } }
				: {}),
			...(t.weight ? { Weight: t.weight } : {}),
		};
	}

	// Standalone group: only on STANDALONE (schema enforces this).
	if (t.type === 'STANDALONE') {
		record.Standalone = {
			...(t.os ? { OS: t.os } : {}),
			...(t.processor ? { Processor: t.processor } : {}),
			...(t.usb ? { USB: t.usb } : {}),
			...(t.speakers ? { Speakers: t.speakers } : {}),
		};
	}

	return record;
}

const tabletRecords = TABLETS.map(buildTablet);

const penRecords = PENS.map((p) => ({
	EntityId: BRAND.toLowerCase() + '.pen.' + p.id.replace(/[^A-Za-z0-9]/g, '').toLowerCase(),
	Brand: BRAND,
	PenId: p.id,
	PenName: p.name,
	PenFamily: p.family,
	ReleaseYear: p.year,
	_id: randomUUID(),
	_CreateDate: TODAY,
	_ModifiedDate: TODAY,
}));

const familyRecords = FAMILIES.map((f) => ({
	EntityId: f.entityId,
	Brand: BRAND,
	FamilyName: f.name,
	_id: randomUUID(),
	_CreateDate: TODAY,
	_ModifiedDate: TODAY,
}));

const penCompatRecords = PEN_COMPAT.map((c) => ({
	Brand: BRAND,
	PenId: c.penId,
	TabletIds: c.tabletIds,
}));

// --- Write ---

// The default preview explicitly starts an empty dataset. A supplied root must
// already have all required source collections, so missing inputs remain errors.
if (rootArg < 0) {
	for (const name of ['tablets', 'pens', 'pressure-response']) {
		const dir = path.join(REPO_ROOT, 'source', name);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, '.gitkeep'), '');
	}
}

// This template creates a NEW brand. Re-running over existing sources would
// give every record a fresh _id and leave behind the files of any entry you
// removed from the arrays, so refuse; delete the brand's source directories
// first if you really mean to start over.
const tablets = sourceCollection('tablets');
const pens = sourceCollection('pens');
for (const c of [tablets, pens]) {
	const dir = path.join(REPO_ROOT, 'source', c.name, BRAND.toLowerCase());
	if (fs.existsSync(dir)) {
		console.error(`${dir} already exists; this template only creates a new brand.`);
		process.exit(1);
	}
}

// One validated transaction includes sources and related grouped records.
const regenerated = commitDatasetUpdate(
	REPO_ROOT,
	[
		...tabletRecords.map((record) => ({ collection: 'tablets', record })),
		...penRecords.map((record) => ({ collection: 'pens', record })),
	],
	{
		dataFiles: new Map([
			[
				'data/tablet-families/' + BRAND + '-tablet-families.json',
				{ TabletFamilies: familyRecords },
			],
			['data/pen-compat/' + BRAND + '-pen-compat.json', { PenCompat: penCompatRecords }],
		]),
	},
).changed;

console.log(
	`Wrote ${tabletRecords.length} tablet and ${penRecords.length} pen source files, ` +
		`${familyRecords.length} families, ${penCompatRecords.length} pen-compat groups under ${REPO_ROOT}.`,
);
for (const r of tabletRecords) console.log('  ' + r.Meta.EntityId);
for (const r of penRecords) console.log('  ' + r.EntityId);
for (const f of regenerated) console.log(`Regenerated ${f}.`);
