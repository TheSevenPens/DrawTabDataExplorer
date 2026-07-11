import type { DrawTabDataSet } from '$data/lib/dataset.js';
import type { Query, FilterOp } from '@thesevenpens/queriton';
import type {
	BuilderCollection,
	BuilderFilter,
	BuilderOutput,
	BuilderSort,
} from './mockup-templates.js';
import { completeBuilderFilters } from './filter-complete.js';
import { buildSummarizeSpec } from './summarize-spec.js';

export interface BuilderQueryState {
	collection: BuilderCollection;
	filters: BuilderFilter[];
	sorts: BuilderSort[];
	columns: string[];
	skip?: number;
	take?: number;
	/** Filters on summary rows after .summarize() (SQL HAVING). */
	havingFilters?: BuilderFilter[];
	output: BuilderOutput;
}

function collectionQuery(ds: DrawTabDataSet, collection: BuilderCollection): Query<unknown> {
	switch (collection) {
		case 'Tablets':
			return ds.Tablets as Query<unknown>;
		case 'Pens':
			return ds.Pens as Query<unknown>;
		case 'PenCompat':
			return ds.PenCompat as Query<unknown>;
		case 'Drivers':
			return ds.Drivers as Query<unknown>;
		case 'PressureResponse':
			return ds.PressureResponse as Query<unknown>;
	}
}

function parseFilterInValues(value: string): string[] {
	return value
		.split(',')
		.map((v) => v.trim())
		.filter(Boolean);
}

export function applyFilters(q: Query<unknown>, filters: BuilderFilter[]): Query<unknown> {
	let query = q;
	for (const f of completeBuilderFilters(filters)) {
		if (f.operator === 'in') {
			query = query.filterIn(f.field, parseFilterInValues(f.value));
		} else {
			query = query.filter(f.field, f.operator as FilterOp, f.value);
		}
	}
	return query;
}

export function countAliasForSorts(sorts: BuilderSort[]): string {
	return sorts.some((s) => !s.disabled && s.field === 'tablets') ? 'tablets' : 'count';
}

/** Run a visual builder state against a live DrawTabDataSet. */
export async function executeBuilderQuery(
	ds: DrawTabDataSet,
	state: BuilderQueryState,
): Promise<unknown> {
	let q = applyFilters(collectionQuery(ds, state.collection), state.filters);

	if (state.output.mode === 'distinct') {
		return q.distinct(state.output.field);
	}

	if (state.output.mode === 'count') {
		return q.count();
	}

	if (state.output.mode === 'countBy') {
		const by = state.output.fields.length === 1 ? state.output.fields[0] : state.output.fields;
		q = q.countBy(by, {
			countAlias: countAliasForSorts(state.sorts),
			sort: 'none',
		}) as Query<unknown>;
		for (const s of state.sorts.filter((x) => !x.disabled)) {
			q = q.sort(s.field, s.direction) as Query<unknown>;
		}
		return q.toArray();
	}

	if (state.output.mode === 'summarize') {
		const spec = buildSummarizeSpec(state.output.groupBy, state.output.aggregators);
		if (!spec) {
			throw new Error('Summarize requires at least one complete aggregator.');
		}
		q = q.summarize(spec) as Query<unknown>;
		q = applyFilters(q, state.havingFilters ?? []);
		for (const s of state.sorts.filter((x) => !x.disabled)) {
			q = q.sort(s.field, s.direction);
		}
		if (state.skip != null && state.skip > 0) {
			q = q.skip(state.skip);
		}
		if (state.take != null && state.take > 0) {
			q = q.take(state.take);
		}
		return q.toArray();
	}

	if (state.columns.length > 0) {
		q = q.select(state.columns) as Query<unknown>;
	}
	for (const s of state.sorts.filter((x) => !x.disabled)) {
		q = q.sort(s.field, s.direction);
	}
	if (state.skip != null && state.skip > 0) {
		q = q.skip(state.skip);
	}
	if (state.take != null && state.take > 0) {
		q = q.take(state.take);
	}
	return q.toArray();
}
