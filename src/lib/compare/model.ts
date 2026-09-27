/**
 * The comparison model behind /compare (#373).
 *
 * A comparison is a list of **columns** of one kind (tablets or pens). A
 * column is built from member references: a single model, a family (kept
 * live — its members come from the data at render time), or an ad-hoc group
 * of any mix of models, families and, for pens, inventory units. Nothing is
 * resolved here; resolve.ts turns a column into concrete records.
 *
 * All operations are pure: they take a Comparison and return a new one, so
 * the Svelte store reassigns (see CLAUDE.md on reactive state) and the logic
 * is testable without a DOM.
 *
 * **A ref appears at most once.** The same pen, family or unit can't sit in
 * two columns (or twice in one): adding one that's already present is a
 * no-op, and adding it *into* a column moves it there. Overlap through
 * different refs stays allowed on purpose — a pen beside its own family, a
 * unit beside its pen — and resolve.ts's findOverlaps reports it.
 */

export type CompareKind = 'tablets' | 'pens';

/** Most columns one comparison holds — also the chart palette's identity slots. */
export const MAX_COLUMNS = 8;

export type MemberType = 'model' | 'family' | 'unit';

export interface MemberRef {
	type: MemberType;
	/** Model / family EntityId, or an inventory unit's InventoryId. Stored lowercase. */
	id: string;
}

export interface CompareColumn {
	id: string;
	/** User-given name. Unset: a model or family column shows its own name, a group "Group N". */
	name?: string;
	refs: MemberRef[];
	/** Model EntityIds (lowercase) dropped from this column's families. */
	excluded: string[];
}

export interface Comparison {
	kind: CompareKind;
	columns: CompareColumn[];
	/** Monotonic counter for column ids and default group names. */
	seq: number;
}

export function emptyComparison(kind: CompareKind): Comparison {
	return { kind, columns: [], seq: 0 };
}

export const refKey = (r: MemberRef) => `${r.type}:${r.id.toLowerCase()}`;

const normalize = (r: MemberRef): MemberRef => ({ type: r.type, id: r.id.toLowerCase() });

export function isFull(c: Comparison): boolean {
	return c.columns.length >= MAX_COLUMNS;
}

/** The column that holds `ref` directly, if any. */
export function holderOf(c: Comparison, ref: MemberRef): CompareColumn | undefined {
	const key = refKey(ref);
	return c.columns.find((col) => col.refs.some((r) => refKey(r) === key));
}

/** Drop refs from every column except `keepId`; unnamed columns left empty go. */
function withoutRefs(c: Comparison, refs: readonly MemberRef[], keepId: string): Comparison {
	const keys = new Set(refs.map(refKey));
	return {
		...c,
		columns: c.columns
			.map((col) =>
				col.id === keepId ? col : { ...col, refs: col.refs.filter((r) => !keys.has(refKey(r))) },
			)
			.filter((col) => col.id === keepId || col.refs.length > 0 || col.name !== undefined),
	};
}

function nextColumn(c: Comparison, refs: MemberRef[], name?: string): [CompareColumn, number] {
	const seq = c.seq + 1;
	return [
		{ id: `c${seq}`, ...(name ? { name } : {}), refs: refs.map(normalize), excluded: [] },
		seq,
	];
}

/**
 * Add a reference as a column of its own, or into an existing column.
 *
 * - As its own column: a no-op if the ref is already anywhere in the
 *   comparison, and refused past MAX_COLUMNS.
 * - Into a column: a no-op if that column holds it; if another column does,
 *   the ref *moves* here (that column goes if it was unnamed and is now empty).
 */
export function addRef(c: Comparison, ref: MemberRef, intoColumnId?: string): Comparison {
	const r = normalize(ref);
	const holder = holderOf(c, r);
	if (intoColumnId) {
		if (holder?.id === intoColumnId || !c.columns.some((col) => col.id === intoColumnId)) return c;
		const moved = holder ? withoutRefs(c, [r], intoColumnId) : c;
		return {
			...moved,
			columns: moved.columns.map((col) =>
				col.id !== intoColumnId
					? col
					: { ...col, refs: [...col.refs, r], excluded: col.excluded.filter((e) => e !== r.id) },
			),
		};
	}
	if (holder || isFull(c)) return c;
	const [col, seq] = nextColumn(c, [r]);
	return { ...c, seq, columns: [...c.columns, col] };
}

/** Add several refs, each as its own column, stopping at MAX_COLUMNS. */
export function addRefs(c: Comparison, refs: readonly MemberRef[]): Comparison {
	return refs.reduce((acc, r) => addRef(acc, r), c);
}

/** "Group N" with the lowest N no column is already called. */
export function nextGroupName(c: Comparison): string {
	const used = new Set(c.columns.map((col) => col.name));
	let n = 1;
	while (used.has(`Group ${n}`)) n++;
	return `Group ${n}`;
}

/**
 * A new named group holding `refs` (possibly none yet — a drop target). Refs
 * already in other columns move into it, so nothing appears twice.
 */
export function newGroup(c: Comparison, refs: readonly MemberRef[] = []): Comparison {
	if (isFull(c)) return c;
	const unique = [...new Map(refs.map((r) => [refKey(r), normalize(r)])).values()];
	const [col, seq] = nextColumn(c, unique, nextGroupName(c));
	const cleared = withoutRefs(c, unique, col.id);
	return { ...cleared, seq, columns: [...cleared.columns, col] };
}

export function removeColumn(c: Comparison, columnId: string): Comparison {
	return { ...c, columns: c.columns.filter((col) => col.id !== columnId) };
}

/** Remove one ref from a column; a column left empty goes too. */
export function removeRef(c: Comparison, columnId: string, ref: MemberRef): Comparison {
	const key = refKey(ref);
	return {
		...c,
		columns: c.columns
			.map((col) =>
				col.id === columnId ? { ...col, refs: col.refs.filter((r) => refKey(r) !== key) } : col,
			)
			.filter((col) => col.refs.length > 0 || col.name !== undefined),
	};
}

/** Move a ref from one column to another (drag between columns). */
export function moveRef(
	c: Comparison,
	fromColumnId: string,
	toColumnId: string,
	ref: MemberRef,
): Comparison {
	if (fromColumnId === toColumnId) return c;
	return removeRef(addRef(c, ref, toColumnId), fromColumnId, ref);
}

/** Merge column `fromId` into `toId` (drop one column onto another). */
export function mergeColumns(c: Comparison, fromId: string, toId: string): Comparison {
	const from = c.columns.find((col) => col.id === fromId);
	if (!from || fromId === toId) return c;
	const merged = from.refs.reduce((acc, r) => addRef(acc, r, toId), c);
	return removeColumn(merged, fromId);
}

export function renameColumn(c: Comparison, columnId: string, name: string): Comparison {
	const trimmed = name.trim();
	return {
		...c,
		columns: c.columns.map((col) => {
			if (col.id !== columnId) return col;
			const { name: _old, ...rest } = col;
			return trimmed ? { ...rest, name: trimmed } : rest;
		}),
	};
}

/** Drop (or restore) one family member from a column. */
export function toggleExcluded(c: Comparison, columnId: string, modelId: string): Comparison {
	const id = modelId.toLowerCase();
	return {
		...c,
		columns: c.columns.map((col) =>
			col.id !== columnId
				? col
				: {
						...col,
						excluded: col.excluded.includes(id)
							? col.excluded.filter((e) => e !== id)
							: [...col.excluded, id],
					},
		),
	};
}

/**
 * Read a stored comparison defensively: anything malformed becomes an empty
 * comparison of the requested kind rather than a crash on load.
 */
export function parseComparison(raw: unknown, kind: CompareKind): Comparison {
	if (!raw || typeof raw !== 'object') return emptyComparison(kind);
	const r = raw as Partial<Comparison>;
	if (r.kind !== kind || !Array.isArray(r.columns)) return emptyComparison(kind);
	const columns = r.columns
		.filter(
			(col): col is CompareColumn =>
				!!col &&
				typeof col.id === 'string' &&
				Array.isArray(col.refs) &&
				col.refs.every(
					(x) =>
						x &&
						typeof x.id === 'string' &&
						(x.type === 'model' || x.type === 'family' || x.type === 'unit'),
				),
		)
		.slice(0, MAX_COLUMNS)
		.map((col) => ({
			id: col.id,
			...(typeof col.name === 'string' ? { name: col.name } : {}),
			refs: col.refs.map(normalize),
			excluded: Array.isArray(col.excluded)
				? col.excluded.filter((e) => typeof e === 'string')
				: [],
		}));
	return {
		kind,
		columns: firstOccurrences(columns),
		seq: typeof r.seq === 'number' ? r.seq : columns.length,
	};
}

/**
 * Keep each ref's first occurrence across the columns — comparisons saved
 * before refs were unique may repeat one — and drop unnamed columns that end
 * up empty.
 */
function firstOccurrences(columns: CompareColumn[]): CompareColumn[] {
	const seen = new Set<string>();
	const out: CompareColumn[] = [];
	for (const col of columns) {
		const refs = col.refs.filter((r) => {
			const key = refKey(r);
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		if (refs.length > 0 || col.name !== undefined) out.push({ ...col, refs });
	}
	return out;
}
