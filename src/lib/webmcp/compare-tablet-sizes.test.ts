import { beforeAll, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { createDiskDataSet } from '$data/lib/dataset-node.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { startWith } from '$lib/compare/entry.js';
import { MAX_COLUMNS, type Comparison } from '$lib/compare/model.js';
import { createCompareTabletSizesTool } from './compare-tablet-sizes.js';

const baseUrl = 'https://thesevenpens.github.io/DrawTabDataExplorer/';
const ids = ['wacom.tablet.pth660', 'wacom.tablet.ptk670'];
let tablets: Tablet[];
beforeAll(async () => {
	const ds = createDiskDataSet({ dataDir: path.resolve('data-repo/data'), userId: 'sevenpens' });
	tablets = await ds.Tablets.toArray();
});

function context(records = tablets) {
	return {
		baseUrl,
		version: null,
		loadTablets: vi.fn(async () => records),
		navigate: vi.fn(async (_url: string) => {}),
		setTabletComparison: vi.fn((_comparison: Comparison) => {}),
	};
}

describe('WebMCP size comparison', () => {
	it('opens Sizes with exactly the resolved models in request order and stays idempotent', async () => {
		let current = startWith('tablets', [{ type: 'model', id: 'wacom.tablet.ctl4100' }]);
		const ctx = context();
		ctx.setTabletComparison.mockImplementation((comparison) => {
			current = comparison;
		});
		const tool = createCompareTabletSizesTool(ctx);
		const result = await tool.execute({ tablets: ['Wacom PTH660', ' PTK-670 '] });
		expect(result).toMatchObject({
			status: 'opened',
			sizeBasis: 'active_area',
			url: `${baseUrl}compare/tablets#sizes`,
		});
		expect(ctx.loadTablets).toHaveBeenCalledOnce();
		expect(ctx.navigate).toHaveBeenCalledWith(`${baseUrl}compare/tablets#sizes`);
		expect(current.kind).toBe('tablets');
		expect(current.columns.map((column) => column.refs)).toEqual(
			ids.map((id) => [{ type: 'model', id }]),
		);
		const first = current;
		await tool.execute({ tablets: ids });
		expect(current).toEqual(first);
	});

	it('does not replace the comparison until navigation succeeds', async () => {
		const ctx = context();
		let complete!: () => void;
		ctx.navigate.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					complete = resolve;
				}),
		);
		const execution = createCompareTabletSizesTool(ctx).execute({ tablets: ids });
		await vi.waitFor(() => expect(ctx.navigate).toHaveBeenCalledOnce());
		expect(ctx.setTabletComparison).not.toHaveBeenCalled();
		complete();
		expect((await execution).status).toBe('opened');
		expect(ctx.setTabletComparison).toHaveBeenCalledOnce();
	});

	it.each([
		null,
		{},
		{ tablets: 'PTH660' },
		{ tablets: ['PTH660'] },
		{ tablets: ['PTH660', '  '] },
		{ tablets: ['PTH660', 2] },
		{ tablets: ['PTH660', 'x'.repeat(201)] },
		{ tablets: Array(MAX_COLUMNS + 1).fill('PTH660') },
		{ tablets: ids, extra: true },
	])('rejects malformed arguments before loading or changing anything: %j', async (input) => {
		const ctx = context();
		expect((await createCompareTabletSizesTool(ctx).execute(input)).status).toBe('invalid_input');
		expect(ctx.loadTablets).not.toHaveBeenCalled();
		expect(ctx.navigate).not.toHaveBeenCalled();
		expect(ctx.setTabletComparison).not.toHaveBeenCalled();
	});

	it('reports every unresolved tablet without partially adding the valid one', async () => {
		const ctx = context();
		const result = await createCompareTabletSizesTool(ctx).execute({
			tablets: ['PTH660', 'Wacom Intuos Small', 'no-such-tablet-xyz'],
		});
		if (result.status !== 'needs_resolution') throw new Error(result.status);
		expect(result.results.map((r) => r.status)).toEqual(['found', 'ambiguous', 'not_found']);
		expect(result.results[1]).toMatchObject({
			candidates: expect.arrayContaining([
				expect.objectContaining({ entityId: 'wacom.tablet.ctl4100' }),
			]),
		});
		expect(result.message).toContain('compare_tablet_sizes');
		expect(ctx.navigate).not.toHaveBeenCalled();
		expect(ctx.setTabletComparison).not.toHaveBeenCalled();
	});

	it('rejects two names for the same model', async () => {
		const ctx = context();
		expect(
			(await createCompareTabletSizesTool(ctx).execute({ tablets: ['PTH660', ids[0]] })).status,
		).toBe('invalid_input');
		expect(ctx.navigate).not.toHaveBeenCalled();
		expect(ctx.setTabletComparison).not.toHaveBeenCalled();
	});

	it.each([undefined, 0, -1, NaN])(
		'does not silently omit a tablet with unusable width %s',
		async (width) => {
			const records = tablets.map((tablet) =>
				tablet.Meta.EntityId !== ids[1]
					? tablet
					: {
							...tablet,
							Digitizer: {
								...tablet.Digitizer,
								Dimensions: { ...tablet.Digitizer?.Dimensions, Width: width },
							},
						},
			);
			const ctx = context(records);
			expect(await createCompareTabletSizesTool(ctx).execute({ tablets: ids })).toMatchObject({
				status: 'missing_dimensions',
				tablets: [expect.objectContaining({ entityId: ids[1] })],
			});
			expect(ctx.navigate).not.toHaveBeenCalled();
			expect(ctx.setTabletComparison).not.toHaveBeenCalled();
		},
	);

	it.each(['empty', 'failed'])(
		'leaves the current comparison alone when data is %s',
		async (kind) => {
			const ctx = context([]);
			if (kind === 'failed') ctx.loadTablets.mockRejectedValue(new Error('offline'));
			expect((await createCompareTabletSizesTool(ctx).execute({ tablets: ids })).status).toBe(
				'unavailable',
			);
			expect(ctx.navigate).not.toHaveBeenCalled();
			expect(ctx.setTabletComparison).not.toHaveBeenCalled();
		},
	);

	it('preserves the current comparison if navigation rejects', async () => {
		const ctx = context();
		ctx.navigate.mockRejectedValue(new Error('cancelled'));
		expect((await createCompareTabletSizesTool(ctx).execute({ tablets: ids })).status).toBe(
			'navigation_failed',
		);
		expect(ctx.setTabletComparison).not.toHaveBeenCalled();
	});
});
