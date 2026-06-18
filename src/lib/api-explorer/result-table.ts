// Flatten an arbitrary query result into a { columns, rows } shape an HTML
// table can render, and strip loader-internal bookkeeping fields for display.
// Extracted from the /api-explorer route (GitHub #222) — these are pure data
// transforms, so they live here and are unit-tested independently of the page.
//
// Three supported kinds:
//   array-of-objects     → columns = union of leaf keys, rows = one per item
//   object               → two columns (Key / Value), one row per top-level key
//   array-of-primitives  → one column "Value", one row per item
//
// Nested objects flatten with dot-paths (Model.Brand). Arrays inside cells are
// summarised — primitive arrays as comma-joined values, object arrays as
// "[N items]" so the cell stays scannable. Use the JSON view for the full
// payload.

export type TableShape =
	| { kind: 'array-of-objects'; columns: string[]; rows: Record<string, string>[] }
	| { kind: 'object'; columns: ['Key', 'Value']; rows: { Key: string; Value: string }[] }
	| { kind: 'array-of-primitives'; columns: ['Value']; rows: { Value: string }[] }
	| { kind: 'not-tabular'; reason: string };

const MAX_CELL_CHARS = 120;

export function formatCell(v: unknown): string {
	if (v === null || v === undefined) return '';
	if (typeof v === 'string') return v;
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	if (Array.isArray(v)) {
		if (v.length === 0) return '[]';
		const allPrimitive = v.every(
			(x) => x === null || x === undefined || ['string', 'number', 'boolean'].includes(typeof x),
		);
		if (allPrimitive) {
			const joined = v.map((x) => (x === null || x === undefined ? '' : String(x))).join(', ');
			return joined.length > MAX_CELL_CHARS ? joined.slice(0, MAX_CELL_CHARS - 1) + '…' : joined;
		}
		return `[${v.length} item${v.length === 1 ? '' : 's'}]`;
	}
	// Object — small summary (avoid full nested stringify).
	const keys = Object.keys(v as object);
	return keys.length === 0 ? '{}' : `{${keys.length} key${keys.length === 1 ? '' : 's'}}`;
}

function flattenObject(
	obj: Record<string, unknown>,
	prefix: string,
	out: Map<string, string>,
): void {
	for (const [k, v] of Object.entries(obj)) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (
			v !== null &&
			typeof v === 'object' &&
			!Array.isArray(v) &&
			// Don't flatten Date / Map / Set / etc.
			v.constructor === Object
		) {
			flattenObject(v as Record<string, unknown>, key, out);
		} else {
			out.set(key, formatCell(v));
		}
	}
}

export function buildTableShape(value: unknown): TableShape {
	if (value === null || value === undefined) {
		return { kind: 'not-tabular', reason: 'Result is null/undefined.' };
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return { kind: 'not-tabular', reason: 'Empty array.' };
		}
		const allPrimitive = value.every(
			(x) => x === null || x === undefined || ['string', 'number', 'boolean'].includes(typeof x),
		);
		if (allPrimitive) {
			return {
				kind: 'array-of-primitives',
				columns: ['Value'],
				rows: value.map((x) => ({
					Value: x === null || x === undefined ? '' : String(x),
				})),
			};
		}
		const allObjects = value.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x));
		if (!allObjects) {
			return { kind: 'not-tabular', reason: 'Mixed-shape array — use JSON view.' };
		}
		// Flatten each row; union the column order in first-seen sequence.
		const columns: string[] = [];
		const seen = new Set<string>();
		const rows = value.map((row) => {
			const flat = new Map<string, string>();
			flattenObject(row as Record<string, unknown>, '', flat);
			for (const k of flat.keys()) {
				if (!seen.has(k)) {
					seen.add(k);
					columns.push(k);
				}
			}
			return Object.fromEntries(flat);
		});
		return { kind: 'array-of-objects', columns, rows };
	}
	if (typeof value === 'object') {
		const flat = new Map<string, string>();
		flattenObject(value as Record<string, unknown>, '', flat);
		return {
			kind: 'object',
			columns: ['Key', 'Value'],
			rows: [...flat.entries()].map(([Key, Value]) => ({ Key, Value })),
		};
	}
	return {
		kind: 'not-tabular',
		reason: `Result is a ${typeof value}, not an array or object.`,
	};
}

// Strip the loader-internal bookkeeping fields (Meta._id, top-level _id,
// _CreateDate, _ModifiedDate) from the result for display by default.
// Meta.EntityId stays — it's the canonical user-facing identifier.
const META_NOISE_KEYS = new Set(['_id', '_CreateDate', '_ModifiedDate']);

export function stripMetaNoise(value: unknown): unknown {
	if (value === null || typeof value !== 'object') return value;
	if (Array.isArray(value)) return value.map(stripMetaNoise);
	const obj = value as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (META_NOISE_KEYS.has(k)) continue;
		if (k === 'Meta' && v && typeof v === 'object' && !Array.isArray(v)) {
			// Keep Meta.EntityId, drop the bookkeeping inside Meta.
			const metaObj = v as Record<string, unknown>;
			const filtered: Record<string, unknown> = {};
			for (const [mk, mv] of Object.entries(metaObj)) {
				if (!META_NOISE_KEYS.has(mk)) filtered[mk] = mv;
			}
			out[k] = filtered;
			continue;
		}
		out[k] = stripMetaNoise(v);
	}
	return out;
}
