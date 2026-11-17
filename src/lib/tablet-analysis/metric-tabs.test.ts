import { describe, expect, it } from 'vitest';
import type { MetricRankRow } from '$lib/tablet-analysis/helpers.js';
import {
	defaultRankFilters,
	metricTabAliases,
	metricTabFromHash,
	metricTabHash,
	metricTabs,
	parseMetricNumber,
	rankFilename,
	rankMetric,
} from '$lib/tablet-analysis/metric-tabs.js';

function row(entityId: string, value: number, brand = 'WACOM', type = 'PENDISPLAY'): MetricRankRow {
	return { entityId, name: entityId, id: entityId, brand, type, year: '2020', value };
}

describe('metric tab hashes', () => {
	it('uses the bare section id for Distribution', () => {
		expect(metricTabHash('digitizer-density', 'distribution')).toBe('digitizer-density');
	});

	it('keeps the old separate-section ids for Lowest / Highest', () => {
		expect(metricTabHash('display-pixel-density', 'lowest')).toBe('display-pixel-density-lowest');
		expect(metricTabHash('display-pixel-density', 'highest')).toBe('display-pixel-density-highest');
	});

	it('round-trips every tab, with or without the leading #', () => {
		for (const tab of ['distribution', 'lowest', 'highest'] as const) {
			const h = metricTabHash('digitizer-density', tab);
			expect(metricTabFromHash(h, 'digitizer-density')).toBe(tab);
			expect(metricTabFromHash(`#${h}`, 'digitizer-density')).toBe(tab);
		}
	});

	it('falls back to Distribution for an unrelated or empty hash', () => {
		expect(metricTabFromHash('', 'digitizer-density')).toBe('distribution');
		expect(metricTabFromHash('display-pixel-density-lowest', 'digitizer-density')).toBe(
			'distribution',
		);
	});

	it('aliases both rank hashes of each section to that section', () => {
		expect(metricTabAliases(['a', 'b'])).toEqual({
			'a-lowest': 'a',
			'a-highest': 'a',
			'b-lowest': 'b',
			'b-highest': 'b',
		});
	});
});

describe('metricTabs / rankFilename', () => {
	it('defaults to Lowest / Highest', () => {
		expect(metricTabs().map((t) => t.label)).toEqual(['Distribution', 'Lowest', 'Highest']);
	});

	it('renames the rank tabs without changing their ids', () => {
		const tabs = metricTabs('Smallest', 'Largest');
		expect(tabs.map((t) => t.label)).toEqual(['Distribution', 'Smallest', 'Largest']);
		expect(tabs.map((t) => t.id)).toEqual(['distribution', 'lowest', 'highest']);
	});

	it('builds the export filename from the base and the tab label', () => {
		expect(rankFilename('analysis-digitizer-density', 'Lowest')).toBe(
			'analysis-digitizer-density-lowest',
		);
		expect(rankFilename('analysis-pen-tablet-diagonal', 'Largest')).toBe(
			'analysis-pen-tablet-diagonal-largest',
		);
	});
});

describe('rankMetric', () => {
	const rows = [
		row('x.tablet.c', 3),
		row('x.tablet.a', 1, 'HUION'),
		row('x.tablet.b', 2, 'WACOM', 'STANDALONE'),
		row('x.tablet.d', 3),
	];

	it('ranks lowest first and highest first, breaking ties on EntityId', () => {
		const f = defaultRankFilters();
		expect(rankMetric(rows, 'lowest', f.lowest).map((r) => r.entityId)).toEqual([
			'x.tablet.a',
			'x.tablet.b',
			'x.tablet.c',
			'x.tablet.d',
		]);
		expect(rankMetric(rows, 'highest', f.highest).map((r) => r.entityId)).toEqual([
			'x.tablet.c',
			'x.tablet.d',
			'x.tablet.b',
			'x.tablet.a',
		]);
	});

	it('applies type, brand and count', () => {
		expect(
			rankMetric(rows, 'highest', { type: 'PENDISPLAY', brand: 'WACOM', count: 1 }).map(
				(r) => r.entityId,
			),
		).toEqual(['x.tablet.c']);
		expect(rankMetric(rows, 'lowest', { type: 'STANDALONE', brand: '', count: 10 })).toHaveLength(
			1,
		);
	});

	it('gives each direction its own filter object', () => {
		const f = defaultRankFilters();
		f.lowest.brand = 'HUION';
		expect(f.highest.brand).toBe('');
	});
});

describe('parseMetricNumber', () => {
	it('parses numeric strings and numbers', () => {
		expect(parseMetricNumber('250')).toBe(250);
		expect(parseMetricNumber('0.5')).toBe(0.5);
		expect(parseMetricNumber(8)).toBe(8);
	});

	it('treats blank and non-numeric values as missing', () => {
		expect(parseMetricNumber(undefined)).toBeNull();
		expect(parseMetricNumber(null)).toBeNull();
		expect(parseMetricNumber('')).toBeNull();
		expect(parseMetricNumber('n/a')).toBeNull();
	});
});
