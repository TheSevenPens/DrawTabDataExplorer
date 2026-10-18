import { describe, it, expect } from 'vitest';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { buildMetric } from './numeric-sections.js';

const t = (v: string | null | undefined) =>
	({ Model: { ReleaseYear: '2020' }, v }) as unknown as Tablet;
const getValue = (x: Tablet) => (x as unknown as { v: string | null | undefined }).v;

describe('buildMetric', () => {
	const section = buildMetric(
		{ id: 'm', title: 'M', unit: 'u', getValue, ranges: [], binSize: 1 },
		[t('5'), t(null), t(''), t(undefined), t('x'), t('7')],
		6,
		'tablets',
		'analysis-',
		null,
	);

	it('charts only recorded numeric values, never a missing one as 0', () => {
		expect(section.histogram?.values).toEqual([5, 7]);
	});

	it('counts the same tablets in the table', () => {
		expect(section.data.count).toBe(2);
		expect(section.data.rows.map((r) => r.label)).toEqual(['5', '7']);
	});
});
