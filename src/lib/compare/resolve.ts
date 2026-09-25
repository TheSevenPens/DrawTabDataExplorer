/**
 * Turn comparison columns into concrete records (#373).
 *
 * Generic over the model type so tablets and pens share it. The context
 * supplies lookups from the loaded data; nothing here fetches.
 *
 * - A model ref contributes that model.
 * - A family ref contributes its current members (live: a model added to
 *   the family in the data joins the column), minus the column's excluded.
 * - A unit ref (pens) contributes its model's *specs* — a unit has no specs
 *   of its own — but only its *own* pressure sessions.
 *
 * Models are de-duplicated within a column (reached twice = counted once)
 * and kept across columns: the same pen may sit in two groups, which
 * `findOverlaps` reports so the UI can say so.
 */

import type { CompareColumn, MemberRef } from './model';

export interface ResolveContext<T> {
	/** Look a model up by lowercase EntityId. */
	model(id: string): T | undefined;
	/** A family's members, by lowercase family EntityId; unknown family → []. */
	familyMembers(familyId: string): T[];
	familyName(familyId: string): string | undefined;
	/** Pens only: a unit's model EntityId (lowercase), by lowercase InventoryId. */
	unitModelId?(unitId: string): string | undefined;
	/** Pens only: how to label a unit (e.g. "WAP.0030"). */
	unitLabel?(unitId: string): string;
	modelId(m: T): string;
	modelLabel(m: T): string;
}

export type ColumnKind = 'model' | 'family' | 'unit' | 'group';

export interface ResolvedRef {
	ref: MemberRef;
	label: string;
	/** Members a family contributes (after exclusions); 1 for a model or unit. */
	count: number;
	/** The ref names nothing in the current data. */
	missing: boolean;
}

export interface ResolvedColumn<T> {
	id: string;
	name: string;
	kind: ColumnKind;
	refs: ResolvedRef[];
	/** Distinct models, in first-reached order. */
	models: T[];
	/** Sessions of these models count in full (model and family refs). */
	sessionModelIds: Set<string>;
	/** Sessions of these units count (unit refs), whatever their model. */
	sessionUnitIds: Set<string>;
	/** Family members dropped from this column, as labels. */
	excluded: { id: string; label: string }[];
}

export function resolveColumn<T>(col: CompareColumn, ctx: ResolveContext<T>): ResolvedColumn<T> {
	const excluded = new Set(col.excluded);
	const models = new Map<string, T>();
	const sessionModelIds = new Set<string>();
	const sessionUnitIds = new Set<string>();
	const refs: ResolvedRef[] = [];
	const add = (m: T) => {
		const id = ctx.modelId(m);
		if (!models.has(id)) models.set(id, m);
		return id;
	};

	for (const ref of col.refs) {
		if (ref.type === 'model') {
			const m = ctx.model(ref.id);
			if (m) sessionModelIds.add(add(m));
			refs.push({ ref, label: m ? ctx.modelLabel(m) : ref.id, count: m ? 1 : 0, missing: !m });
		} else if (ref.type === 'family') {
			const members = ctx.familyMembers(ref.id).filter((m) => !excluded.has(ctx.modelId(m)));
			for (const m of members) sessionModelIds.add(add(m));
			const name = ctx.familyName(ref.id);
			refs.push({ ref, label: name ?? ref.id, count: members.length, missing: name === undefined });
		} else {
			const modelId = ctx.unitModelId?.(ref.id);
			const m = modelId ? ctx.model(modelId) : undefined;
			if (m) add(m);
			if (modelId) sessionUnitIds.add(ref.id);
			const unit = ctx.unitLabel?.(ref.id) ?? ref.id.toUpperCase();
			refs.push({
				ref,
				label: m ? `${unit} · ${ctx.modelLabel(m)}` : unit,
				count: m ? 1 : 0,
				missing: !m,
			});
		}
	}

	const excludedList = col.excluded.map((id) => {
		const m = ctx.model(id);
		return { id, label: m ? ctx.modelLabel(m) : id };
	});

	const kind: ColumnKind =
		col.refs.length === 1 && col.name === undefined ? col.refs[0].type : 'group';
	const name = col.name ?? (kind === 'group' ? 'Group' : (refs[0]?.label ?? 'Empty'));

	return {
		id: col.id,
		name,
		kind,
		refs,
		models: [...models.values()],
		sessionModelIds,
		sessionUnitIds,
		excluded: excludedList,
	};
}

export function resolveColumns<T>(
	cols: readonly CompareColumn[],
	ctx: ResolveContext<T>,
): ResolvedColumn<T>[] {
	return cols.map((c) => resolveColumn(c, ctx));
}

/** A session belongs to a column when its pen is a model/family member, or its unit is a unit member. */
export function sessionInColumn(
	col: Pick<ResolvedColumn<unknown>, 'sessionModelIds' | 'sessionUnitIds'>,
	session: { PenEntityId: string; InventoryId: string },
): boolean {
	return (
		col.sessionModelIds.has(session.PenEntityId.toLowerCase()) ||
		col.sessionUnitIds.has(session.InventoryId.toLowerCase())
	);
}

/**
 * Models that appear in more than one column, per column:
 * columnId → [{ modelLabel, otherColumnNames }]. A comparison that
 * deliberately puts one pen in two groups should say so rather than
 * silently double-count it.
 */
export function findOverlaps<T>(
	cols: readonly ResolvedColumn<T>[],
	ctx: Pick<ResolveContext<T>, 'modelId' | 'modelLabel'>,
): Map<string, { label: string; others: string[] }[]> {
	const where = new Map<string, { label: string; cols: ResolvedColumn<T>[] }>();
	for (const col of cols) {
		for (const m of col.models) {
			const id = ctx.modelId(m);
			const entry = where.get(id) ?? { label: ctx.modelLabel(m), cols: [] };
			entry.cols.push(col);
			where.set(id, entry);
		}
	}
	const out = new Map<string, { label: string; others: string[] }[]>();
	for (const { label, cols: inCols } of where.values()) {
		if (inCols.length < 2) continue;
		for (const col of inCols) {
			const list = out.get(col.id) ?? [];
			list.push({ label, others: inCols.filter((c) => c !== col).map((c) => c.name) });
			out.set(col.id, list);
		}
	}
	return out;
}
