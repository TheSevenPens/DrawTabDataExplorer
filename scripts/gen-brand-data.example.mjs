// Template for bulk-generating tablet / tablet-family / pen-compat JSON
// for a new brand. Adapted from the script used to add Apple iPads
// (35 tablets, 4 families, 4 pen-compat groups) — see CLAUDE.md
// "Adding a new brand" for the full checklist.
//
// Why a generator script and not hand-written JSON?
//   - UUIDs are auto-generated (no copy/paste collisions)
//   - Display.Dimensions is derived from diagonal + pixel aspect
//   - Meta.EntityId is derived from Brand + Model.Id consistently
//   - Adding a new tablet = one entry in the array, not 30 lines of JSON
//
// Usage:
//   1. Copy this file, e.g. cp gen-brand-data.example.mjs gen-foobar.mjs
//   2. Edit BRAND, the TABLETS array, FAMILIES, and PEN_COMPAT
//   3. Flip OUT_DIR from /tmp to data-repo/data/ when ready
//   4. node scripts/gen-foobar.mjs
//   5. npx tsx data-repo/lib/run-data-quality.ts

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// --- Customize ---

const BRAND = 'FOOBAR'; // must already be in BrandEnum (schemas.ts)
const TODAY = new Date().toISOString();
const OUT_DIR = '/tmp/gen-brand-output'; // change to absolute path of data-repo/data when ready

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
			LaunchYear: t.year,
			...(t.audience ? { Audience: t.audience } : {}),
			...(t.family ? { Family: t.family } : {}),
			...(t.productLink ? { ProductLink: t.productLink } : {}),
			...(t.status ? { Status: t.status } : {}),
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

fs.mkdirSync(path.join(OUT_DIR, 'tablets'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'tablet-families'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'pen-compat'), { recursive: true });

fs.writeFileSync(
	path.join(OUT_DIR, 'tablets', `${BRAND}-tablets.json`),
	JSON.stringify({ DrawingTablets: tabletRecords }, null, 2) + '\n',
);
fs.writeFileSync(
	path.join(OUT_DIR, 'tablet-families', `${BRAND}-tablet-families.json`),
	JSON.stringify({ TabletFamilies: familyRecords }, null, 2) + '\n',
);
fs.writeFileSync(
	path.join(OUT_DIR, 'pen-compat', `${BRAND}-pen-compat.json`),
	JSON.stringify({ PenCompat: penCompatRecords }, null, 2) + '\n',
);

console.log(
	`Wrote ${tabletRecords.length} tablets, ${familyRecords.length} families, ` +
		`${penCompatRecords.length} pen-compat groups under ${OUT_DIR}.`,
);
for (const r of tabletRecords) console.log('  ' + r.Meta.EntityId);
