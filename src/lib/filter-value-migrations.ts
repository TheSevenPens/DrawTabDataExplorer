// Saved views and ?filter= URLs persist filter *values*, and two pen fields
// changed what their values are (GitHub #332): pen `Brand` and `PenFamily`
// used to return a display label from getValue ("Wacom", "Wacom KP GEN2 pen
// series") and now return the stored code / EntityId ("WACOM",
// "wacom.penfamily.wacom_kpgen2"). A filter saved against the old label
// would silently match nothing, so labels are rewritten to values on load —
// the value counterpart of field-key-migrations.ts.
//
// Applying this to every entity's `Brand` / `PenFamily` filters is safe: on
// every other entity those fields already held codes / EntityIds, so a label
// there never matched anything and rewriting it can only fix the filter.

import { BRAND_NAMES } from '$data/lib/drawtab-loader.js';

/**
 * Pen-family display name -> EntityId, **frozen** as of the #332 change.
 * Only views saved before that change can hold a family name; anything
 * saved since stores the EntityId. So this table must not track later
 * families or renames — it is a record of what the old labels were.
 */
export const LEGACY_PEN_FAMILY_IDS: Readonly<Record<string, string>> = {
	'Apple Pencil pen series': 'apple.penfamily.applepencil',
	'Asus UD EMR pen series': 'asus.penfamily.udemr',
	'DigiDraw Magic Pen 3 series': 'digidraw.penfamily.digidraw_magicpen3',
	'DigiDraw Magic Pen 5 series': 'digidraw.penfamily.digidraw_magicpen5',
	'Huion PW550 pen series': 'huion.penfamily.huion_pw550',
	'Huion PW600 pen series': 'huion.penfamily.huion_pw600',
	'Samsung S Pen series': 'samsung.penfamily.spen',
	'Staedtler UD EMR pen series': 'staedtler.penfamily.udemr',
	'Wacom CP pen series': 'wacom.penfamily.wacom_cp',
	'Wacom EP pen series': 'wacom.penfamily.wacom_ep',
	'Wacom FP pen series': 'wacom.penfamily.wacom_fp',
	'Wacom Intuos1 GP pen series': 'wacom.penfamily.wacom_gp',
	'Wacom Intuos2 XP pen series': 'wacom.penfamily.wacom_xp',
	'Wacom Intuos3 ZP pen series': 'wacom.penfamily.wacom_zp',
	'Wacom KP GEN1 pen series': 'wacom.penfamily.wacom_kpgen1',
	'Wacom KP GEN2 pen series': 'wacom.penfamily.wacom_kpgen2',
	'Wacom LP pen series': 'wacom.penfamily.wacom_lp',
	'Wacom Pro Pen GEN3 ACP pen series': 'wacom.penfamily.wacom_acp',
	'Wacom SP pen series': 'wacom.penfamily.wacom_sp',
	'Wacom UP pen series': 'wacom.penfamily.wacom_up',
	'XP-Pen X3 Elite pen series': 'xppen.penfamily.xppen_x3elite',
	'XP-Pen X3 Pro pen series': 'xppen.penfamily.xppen_x3pro',
	'Xencelabs Pen V1 series': 'xencelabs.penfamily.xencelabs_penv1',
	'Xencelabs Pen V2 series': 'xencelabs.penfamily.xencelabs_penv2',
};

// Brand labels are matched case-insensitively: display casing has changed
// before ("Digidraw" -> "DigiDraw"), and a code never collides with another
// brand's label.
const BRAND_CODES = new Set(Object.keys(BRAND_NAMES));
const BRAND_BY_LABEL = new Map(
	Object.entries(BRAND_NAMES).map(([code, label]) => [label.toLowerCase(), code]),
);

const VALUE_MIGRATIONS: Readonly<Record<string, (v: string) => string>> = {
	Brand: (v) => (BRAND_CODES.has(v) ? v : (BRAND_BY_LABEL.get(v.toLowerCase()) ?? v)),
	PenFamily: (v) => LEGACY_PEN_FAMILY_IDS[v] ?? v,
};

/** Operators whose value is a `|`-separated list (see queriton's engine). */
const LIST_OPERATORS = new Set(['in', 'notin']);

/**
 * Rewrite one filter value for `field`. Only whole values (or whole list
 * items) that exactly equal an old label are replaced — a partial string
 * someone typed for `contains` is data, and is left alone.
 */
export function migrateFilterValue(field: string, operator: string, value: string): string {
	const map = VALUE_MIGRATIONS[field];
	if (!map || typeof value !== 'string') return value;
	if (LIST_OPERATORS.has(operator)) return value.split('|').map(map).join('|');
	return map(value);
}

/**
 * Deep-copy `value`, migrating every filter-shaped object found anywhere
 * inside it: filter steps (`{ field, operator, value }`) and conditions in
 * boolean trees (`{ field, op, value }`). Everything else round-trips
 * untouched.
 */
export function migrateFilterValues<T>(value: T): T {
	if (Array.isArray(value)) return value.map((v) => migrateFilterValues(v)) as unknown as T;
	if (value === null || typeof value !== 'object') return value;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		out[k] = migrateFilterValues(v);
	}
	const operator = out.operator ?? out.op;
	if (
		typeof out.field === 'string' &&
		typeof operator === 'string' &&
		typeof out.value === 'string'
	) {
		out.value = migrateFilterValue(out.field, operator, out.value);
	}
	return out as T;
}
