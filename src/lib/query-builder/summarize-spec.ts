import type { SummarizeSpec } from '@thesevenpens/queriton';
import {
	type BuilderAggregator,
	completeAggregators,
	isCompleteAggregator,
} from './aggregator-types.js';

export function parseGroupByFields(groupBy: string | string[]): string[] {
	if (Array.isArray(groupBy)) {
		return groupBy.map((s) => s.trim()).filter(Boolean);
	}
	return groupBy
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Build a queriton SummarizeSpec from builder aggregator rows. */
export function buildSummarizeSpec(
	groupBy: string | string[],
	aggregators: BuilderAggregator[],
): SummarizeSpec | null {
	const complete = completeAggregators(aggregators);
	if (complete.length === 0) return null;

	const byFields = parseGroupByFields(groupBy);
	const spec: SummarizeSpec = {};
	if (byFields.length === 1) spec.by = byFields[0];
	else if (byFields.length > 1) spec.by = byFields;

	for (const agg of complete) {
		if (agg.op === 'count') {
			spec.count = agg.name === 'count' ? true : agg.name;
			continue;
		}
		if (agg.op === 'countIf') {
			const cond = {
				field: agg.filterField!,
				op: agg.filterOperator!,
				value: agg.filterValue ?? '',
			};
			spec.countIf = { ...(spec.countIf ?? {}), [agg.name]: cond };
			continue;
		}
		const bucket = agg.op as keyof Pick<
			SummarizeSpec,
			'sum' | 'avg' | 'min' | 'max' | 'median' | 'distinctCount' | 'first' | 'last' | 'collect'
		>;
		const map = { ...(spec[bucket] ?? {}), [agg.name]: agg.field! };
		spec[bucket] = map;
	}

	return spec;
}

function jsString(s: string): string {
	return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Render SummarizeSpec as a JS object literal (for code preview). */
export function formatSummarizeSpec(spec: SummarizeSpec, indent = '    '): string {
	const lines: string[] = [];

	if (spec.by !== undefined) {
		const by =
			typeof spec.by === 'string'
				? jsString(spec.by)
				: `[${spec.by.map((b) => jsString(b)).join(', ')}]`;
		lines.push(`${indent}by: ${by},`);
	}

	if (spec.count) {
		const countVal = spec.count === true ? 'true' : jsString(spec.count);
		lines.push(`${indent}count: ${countVal},`);
	}

	if (spec.countIf) {
		lines.push(`${indent}countIf: {`);
		for (const [name, cond] of Object.entries(spec.countIf)) {
			if (typeof cond === 'function') continue;
			if (!('field' in cond)) continue;
			lines.push(
				`${indent}  ${name}: { field: ${jsString(cond.field)}, op: ${jsString(cond.op)}, value: ${jsString(String(cond.value ?? ''))} },`,
			);
		}
		lines.push(`${indent}},`);
	}

	const fieldedOps = [
		'sum',
		'avg',
		'min',
		'max',
		'median',
		'distinctCount',
		'first',
		'last',
		'collect',
	] as const;

	for (const op of fieldedOps) {
		const map = spec[op];
		if (!map || Object.keys(map).length === 0) continue;
		lines.push(`${indent}${op}: {`);
		for (const [name, field] of Object.entries(map)) {
			lines.push(`${indent}  ${name}: ${jsString(field)},`);
		}
		lines.push(`${indent}},`);
	}

	return `{\n${lines.join('\n')}\n  }`;
}

export { isCompleteAggregator };

/** Output column keys after summarize (group-by keys + aggregator names). */
export function summarizeOutputFieldKeys(
	groupBy: string | string[],
	aggregators: BuilderAggregator[],
): string[] {
	const keys = [...parseGroupByFields(groupBy)];
	for (const a of completeAggregators(aggregators)) {
		const name = a.name.trim();
		if (name && !keys.includes(name)) keys.push(name);
	}
	return keys;
}
