import type {
	BuilderCollection,
	BuilderFilter,
	BuilderOutput,
	BuilderSort,
} from './mockup-templates.js';
import { countAliasForSorts } from './execute-builder-query.js';
import { completeBuilderFilters } from './filter-complete.js';

const COLLECTION_DS: Record<BuilderCollection, string> = {
	Tablets: 'ds.Tablets',
	Pens: 'ds.Pens',
	PenCompat: 'ds.PenCompat',
	Drivers: 'ds.Drivers',
	PressureResponse: 'ds.PressureResponse',
};

function renderFilter(f: BuilderFilter): string {
	if (f.operator === 'in') {
		const values = f.value
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean)
			.map((v) => `'${v}'`);
		return `.filterIn('${f.field}', [${values.join(', ')}])`;
	}
	return `.filter('${f.field}', '${f.operator}', '${f.value.replace(/'/g, "\\'")}')`;
}

export function buildQueryCode(opts: {
	collection: BuilderCollection;
	filters: BuilderFilter[];
	sorts: BuilderSort[];
	columns: string[];
	skip?: number;
	take?: number;
	output: BuilderOutput;
}): string {
	const lines: string[] = [`let q = ${COLLECTION_DS[opts.collection]}`];

	for (const f of completeBuilderFilters(opts.filters)) {
		lines.push(`  ${renderFilter(f)}`);
	}

	if (opts.output.mode === 'distinct') {
		lines.push(`  .distinct('${opts.output.field}')`);
		lines.push('return await q;');
		return lines.join('\n');
	}

	if (opts.output.mode === 'count') {
		lines.push('  .count()');
		lines.push('return await q;');
		return lines.join('\n');
	}

	if (opts.output.mode === 'countBy') {
		const by =
			opts.output.fields.length === 1
				? `'${opts.output.fields[0]}'`
				: `[${opts.output.fields.map((f) => `'${f}'`).join(', ')}]`;
		const alias = countAliasForSorts(opts.sorts);
		const countByOpts =
			alias === 'count' ? '' : `, { countAlias: '${alias}', sort: 'none' }`;
		lines.push(`  .countBy(${by}${countByOpts})`);
	} else if (opts.columns.length > 0) {
		lines.push(`  .select([${opts.columns.map((c) => `'${c}'`).join(', ')}])`);
	}

	for (const s of opts.sorts.filter((x) => !x.disabled)) {
		lines.push(`  .sort('${s.field}', '${s.direction}')`);
	}

	if (opts.skip != null && opts.skip > 0) {
		lines.push(`  .skip(${opts.skip})`);
	}
	if (opts.take != null && opts.take > 0) {
		lines.push(`  .take(${opts.take})`);
	}

	if (opts.output.mode === 'countBy') {
		lines.push('  .toArray()');
	} else {
		lines.push('  .toArray()');
	}

	lines.push('return await q;');
	return lines.join('\n');
}
