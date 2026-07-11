import { describe, it, expect } from 'vitest';
import { buildSummarizeSpec, formatSummarizeSpec, parseGroupByFields } from './summarize-spec.js';
import type { BuilderAggregator } from './aggregator-types.js';

describe('parseGroupByFields', () => {
	it('splits comma-separated keys', () => {
		expect(parseGroupByFields('Brand, ModelType')).toEqual(['Brand', 'ModelType']);
	});
});

describe('buildSummarizeSpec', () => {
	it('builds count with custom name and multi-key groupBy', () => {
		const spec = buildSummarizeSpec(['Brand', 'ModelType'], [{ op: 'count', name: 'tablets' }]);
		expect(spec).toEqual({ by: ['Brand', 'ModelType'], count: 'tablets' });
	});

	it('builds avg/min/max field aggregators', () => {
		const aggs: BuilderAggregator[] = [
			{ op: 'count', name: 'tablets' },
			{ op: 'avg', name: 'avgYear', field: 'ModelLaunchYear' },
			{ op: 'min', name: 'firstYear', field: 'ModelLaunchYear' },
			{ op: 'max', name: 'lastYear', field: 'ModelLaunchYear' },
		];
		const spec = buildSummarizeSpec('Brand', aggs);
		expect(spec?.count).toBe('tablets');
		expect(spec?.avg).toEqual({ avgYear: 'ModelLaunchYear' });
		expect(spec?.min).toEqual({ firstYear: 'ModelLaunchYear' });
		expect(spec?.max).toEqual({ lastYear: 'ModelLaunchYear' });
	});

	it('builds countIf with serialisable filter leaf', () => {
		const spec = buildSummarizeSpec('Brand', [
			{ op: 'count', name: 'total' },
			{
				op: 'countIf',
				name: 'penDisplays',
				filterField: 'ModelType',
				filterOperator: '==',
				filterValue: 'PENDISPLAY',
			},
		]);
		expect(spec?.countIf).toEqual({
			penDisplays: { field: 'ModelType', op: '==', value: 'PENDISPLAY' },
		});
	});

	it('skips incomplete aggregators', () => {
		const spec = buildSummarizeSpec('Brand', [
			{ op: 'avg', name: 'avgYear', field: '' },
			{ op: 'count', name: 'n' },
		]);
		expect(spec).toEqual({ by: 'Brand', count: 'n' });
	});

	it('returns null when nothing is complete', () => {
		expect(buildSummarizeSpec('Brand', [{ op: 'avg', name: 'x', field: '' }])).toBeNull();
	});
});

describe('formatSummarizeSpec', () => {
	it('renders a summarize object for code preview', () => {
		const text = formatSummarizeSpec({
			by: 'Brand',
			count: 'tablets',
			avg: { avgYear: 'ModelLaunchYear' },
		});
		expect(text).toContain("by: 'Brand'");
		expect(text).toContain("count: 'tablets'");
		expect(text).toContain('avgYear');
	});
});
