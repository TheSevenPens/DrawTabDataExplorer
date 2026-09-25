/**
 * Per-kind wiring for the Compare workspace (#373): the lookups the resolver
 * needs and the candidates the add rail searches, built once from the loaded
 * collections. Tablets have models and families; pens add inventory units.
 *
 * Every id is lowercased here — refs, the flag stores and session matching
 * all compare lowercase EntityIds / InventoryIds.
 */

import type { Tablet, Pen, TabletFamily, PenFamily } from '$data/lib/drawtab-loader.js';
import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
import { tabletBrandAndName } from '$lib/tablet-helpers.js';
import { penBrandAndName } from '$lib/pen-helpers.js';
import { tabletIdRedundantInName } from '$data/lib/entities/tablet-fields.js';
import { penIdRedundantInName } from '$data/lib/entities/pen-fields.js';
import type { Candidate } from './candidates';
import type { ResolveContext } from './resolve';

export interface CompareData<T> {
	ctx: ResolveContext<T>;
	candidates: Candidate[];
}

const lc = (s: string) => s.toLowerCase();
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function groupBy<T>(items: readonly T[], key: (t: T) => string): Map<string, T[]> {
	const out = new Map<string, T[]>();
	for (const item of items) {
		const k = key(item);
		if (!k) continue;
		const list = out.get(k);
		if (list) list.push(item);
		else out.set(k, [item]);
	}
	return out;
}

function familyCandidates(
	families: readonly (TabletFamily | PenFamily)[],
	members: Map<string, unknown[]>,
	one: string,
	many: string,
): Candidate[] {
	return families.map((f) => ({
		ref: { type: 'family' as const, id: lc(f.EntityId) },
		kindLabel: `family · ${plural(members.get(lc(f.EntityId))?.length ?? 0, one, many)}`,
		label: f.FamilyName,
		searchTexts: [],
	}));
}

export function tabletCompareData(
	tablets: readonly Tablet[],
	families: readonly TabletFamily[],
): CompareData<Tablet> {
	const byId = new Map(tablets.map((t) => [lc(t.Meta.EntityId), t]));
	const members = groupBy(tablets, (t) => lc(t.Model.Family ?? ''));
	const familyName = new Map(families.map((f) => [lc(f.EntityId), f.FamilyName]));

	const ctx: ResolveContext<Tablet> = {
		model: (id) => byId.get(id),
		familyMembers: (id) => members.get(id) ?? [],
		familyName: (id) => familyName.get(id),
		modelId: (t) => lc(t.Meta.EntityId),
		modelLabel: tabletBrandAndName,
	};

	const candidates: Candidate[] = [
		...familyCandidates(families, members, 'tablet', 'tablets'),
		...tablets.map((t) => ({
			ref: { type: 'model' as const, id: lc(t.Meta.EntityId) },
			kindLabel: t.Model.Type === 'PENTABLET' ? 'pen tablet' : 'pen display',
			label: tabletBrandAndName(t),
			// The id only when the name doesn't already say it (same rule as
			// tabletFullName) — "Huion PW517 (PW517)" restates itself.
			detail: tabletIdRedundantInName(t) ? undefined : t.Model.Id,
			modelId: lc(t.Meta.EntityId),
			searchTexts: [t.Model.Id, ...(t.Model.AlternateNames ?? [])],
		})),
	];
	return { ctx, candidates };
}

export function penCompareData(
	pens: readonly Pen[],
	families: readonly PenFamily[],
	units: readonly InventoryPen[],
): CompareData<Pen> {
	const byId = new Map(pens.map((p) => [lc(p.EntityId), p]));
	const members = groupBy(pens, (p) => lc(p.PenFamily ?? ''));
	const familyName = new Map(families.map((f) => [lc(f.EntityId), f.FamilyName]));
	const unitById = new Map(units.map((u) => [lc(u.InventoryId), u]));

	const ctx: ResolveContext<Pen> = {
		model: (id) => byId.get(id),
		familyMembers: (id) => members.get(id) ?? [],
		familyName: (id) => familyName.get(id),
		unitModelId: (id) => {
			const u = unitById.get(id);
			return u ? lc(u.PenEntityId) : undefined;
		},
		unitLabel: (id) => unitById.get(id)?.InventoryId ?? id.toUpperCase(),
		modelId: (p) => lc(p.EntityId),
		modelLabel: penBrandAndName,
	};

	const candidates: Candidate[] = [
		...familyCandidates(families, members, 'pen', 'pens'),
		...pens.map((p) => ({
			ref: { type: 'model' as const, id: lc(p.EntityId) },
			kindLabel: 'pen',
			label: penBrandAndName(p),
			detail: penIdRedundantInName(p) ? undefined : p.PenId,
			modelId: lc(p.EntityId),
			searchTexts: [p.PenId],
		})),
		...units.map((u) => {
			const pen = byId.get(lc(u.PenEntityId));
			return {
				ref: { type: 'unit' as const, id: lc(u.InventoryId) },
				kindLabel: 'unit · its own sessions',
				label: u.InventoryId,
				detail: pen ? penBrandAndName(pen) : u.PenEntityId,
				modelId: lc(u.PenEntityId),
				searchTexts: pen ? [pen.PenId] : [],
			};
		}),
	];
	return { ctx, candidates };
}
