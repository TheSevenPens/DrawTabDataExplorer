// Aggregator rows for Query Builder summarize output (maps to queriton SummarizeSpec).

export type BuilderAggOp =
	| 'count'
	| 'countIf'
	| 'sum'
	| 'avg'
	| 'min'
	| 'max'
	| 'median'
	| 'distinctCount'
	| 'first'
	| 'last'
	| 'collect';

export interface BuilderAggregator {
	op: BuilderAggOp;
	/** Output column name in the summary row. */
	name: string;
	/** Source field key for field-based aggregators. */
	field?: string;
	/** countIf: condition on source rows (serialisable FilterExpr leaf). */
	filterField?: string;
	filterOperator?: string;
	filterValue?: string;
	disabled?: boolean;
}

export const AGG_OP_OPTIONS: { value: BuilderAggOp; label: string }[] = [
	{ value: 'count', label: 'Count' },
	{ value: 'countIf', label: 'Count if' },
	{ value: 'sum', label: 'Sum' },
	{ value: 'avg', label: 'Average' },
	{ value: 'min', label: 'Min' },
	{ value: 'max', label: 'Max' },
	{ value: 'median', label: 'Median' },
	{ value: 'distinctCount', label: 'Distinct count' },
	{ value: 'first', label: 'First' },
	{ value: 'last', label: 'Last' },
	{ value: 'collect', label: 'Collect' },
];

const VALUELESS_OPS = new Set(['empty', 'notempty']);

export function aggOpNeedsField(op: BuilderAggOp): boolean {
	return op !== 'count' && op !== 'countIf';
}

export function isCompleteAggregator(a: BuilderAggregator): boolean {
	if (a.disabled) return false;
	if (!a.name.trim()) return false;
	if (a.op === 'count') return true;
	if (a.op === 'countIf') {
		if (!a.filterField?.trim() || !a.filterOperator?.trim()) return false;
		if (VALUELESS_OPS.has(a.filterOperator)) return true;
		return (a.filterValue ?? '').trim() !== '';
	}
	return Boolean(a.field?.trim());
}

export function completeAggregators(aggregators: BuilderAggregator[]): BuilderAggregator[] {
	return aggregators.filter(isCompleteAggregator);
}
