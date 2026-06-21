import type {
	Brand,
	Tablet,
	Pen,
	PenCompat,
	PenFamily,
	TabletFamily,
	Driver,
	PressureResponse,
} from '$data/lib/drawtab-loader.js';

export interface Issue {
	entity: string;
	entityId: string;
	field: string;
	issue: string;
	value?: string;
}

export interface CompletionStat {
	field: string;
	populated: number;
	total: number;
	percent: string;
}

export interface IncludedPenMissing {
	tabletId: string;
	tabletName: string;
	penEntityId: string;
	penName: string;
}

export interface DataBundle {
	brands: Brand[];
	tablets: Tablet[];
	pens: Pen[];
	penCompat: PenCompat[];
	penFamilies: PenFamily[];
	tabletFamilies: TabletFamily[];
	drivers: Driver[];
	pressureResponse: PressureResponse[];
	tabletToPens: Map<string, Pen[]>;
	penToTablets: Map<string, Tablet[]>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getByPath(obj: Record<string, any>, path: string): unknown {
	const parts = path.split('.');
	let cur: unknown = obj;
	for (const part of parts) {
		if (cur == null || typeof cur !== 'object') return undefined;
		cur = (cur as Record<string, unknown>)[part];
	}
	return cur;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEntityId(rec: Record<string, any>): string {
	return (getByPath(rec, 'Meta.EntityId') as string) ?? rec.EntityId ?? rec._id ?? 'UNKNOWN';
}

export function checkRequired(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	records: Record<string, any>[],
	entity: string,
	requiredFields: string[],
): Issue[] {
	const found: Issue[] = [];
	for (const rec of records) {
		const eid = getEntityId(rec);
		for (const field of requiredFields) {
			const val = getByPath(rec, field);
			if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
				found.push({ entity, entityId: eid, field, issue: 'missing or empty' });
			}
		}
	}
	return found;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkWhitespace(records: Record<string, any>[], entity: string): Issue[] {
	const found: Issue[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function traverse(obj: Record<string, any>, eid: string, prefix: string) {
		for (const [field, value] of Object.entries(obj)) {
			const path = prefix ? `${prefix}.${field}` : field;
			if (typeof value === 'string' && value !== value.trim()) {
				found.push({
					entity,
					entityId: eid,
					field: path,
					issue: 'leading/trailing whitespace',
					value,
				});
			} else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				traverse(value as Record<string, any>, eid, path);
			}
		}
	}
	for (const rec of records) {
		traverse(rec, getEntityId(rec), '');
	}
	return found;
}

// Inventory ids must be unique within their collection — a repeated
// InventoryId makes per-unit lookups (pressure measurements/sessions keyed on
// it) ambiguous, so a measurement can attach to the wrong physical unit.
// "UNASSIGNED" is a repeatable placeholder, so it's exempt. Mirrors the CLI's
// runInventoryDuplicateCheck in data-repo/lib/data-quality.ts.
export function checkDuplicateInventoryIds(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	records: Record<string, any>[],
	entity: string,
): Issue[] {
	const found: Issue[] = [];
	const seen = new Set<string>();
	for (const rec of records) {
		const invId = rec.InventoryId;
		if (typeof invId !== 'string' || invId === '' || invId === 'UNASSIGNED') continue;
		if (seen.has(invId)) {
			found.push({
				entity,
				entityId: invId,
				field: 'InventoryId',
				issue: 'duplicate InventoryId',
				value: rec.PenEntityId ?? rec.TabletEntityId,
			});
		} else {
			seen.add(invId);
		}
	}
	return found;
}

export function computeCompletion(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	records: Record<string, any>[],
	fields: string[],
): CompletionStat[] {
	const total = records.length;
	return fields
		.map((field) => {
			const populated = records.filter((r) => {
				const v = getByPath(r, field);
				return v !== undefined && v !== null && v !== '';
			}).length;
			return {
				field,
				populated,
				total,
				percent: total > 0 ? ((populated / total) * 100).toFixed(1) : '0',
			};
		})
		.sort((a, b) => parseFloat(a.percent) - parseFloat(b.percent));
}

export function findOrphanedCompat(ds: DataBundle): { type: string; id: string }[] {
	const tabletIds = new Set(ds.tablets.map((t) => t.Model.Id));
	const penIds = new Set(ds.pens.map((p) => p.PenId));
	const orphans: { type: string; id: string }[] = [];
	const seenTablets = new Set<string>();
	const seenPens = new Set<string>();

	for (const row of ds.penCompat) {
		if (!tabletIds.has(row.TabletId) && !seenTablets.has(row.TabletId)) {
			orphans.push({ type: 'Tablet', id: row.TabletId });
			seenTablets.add(row.TabletId);
		}
		if (!penIds.has(row.PenId) && !seenPens.has(row.PenId)) {
			orphans.push({ type: 'Pen', id: row.PenId });
			seenPens.add(row.PenId);
		}
	}
	return orphans;
}
