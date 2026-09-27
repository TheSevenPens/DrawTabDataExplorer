import { beforeAll, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { createDiskDataSet } from '$data/lib/dataset-node.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { parseFilterParams, parseSortParams, parseColumnParams } from '$lib/filter-url.js';
import { executeBuilderQuery } from '$lib/query-builder/execute-builder-query.js';
import { createQueryTabletsTool, createOpenTabletQueryTool } from './query-tablets.js';

const baseUrl = 'https://thesevenpens.github.io/DrawTabDataExplorer/';
const ds = createDiskDataSet({ dataDir: path.resolve('data-repo/data'), userId: 'sevenpens' });
let tablets: Tablet[];
beforeAll(async () => {
	tablets = await ds.Tablets.toArray();
});

function context(records = tablets) {
	return {
		loadTablets: vi.fn(async () => records),
		baseUrl,
		version: null,
		navigate: vi.fn(async (_url: string) => {}),
	};
}

describe('simple tablet queries', () => {
	it('returns the same full result as Query Builder using the equivalent filters', async () => {
		const ctx = context();
		const result = await createQueryTabletsTool(ctx).execute({
			tabletType: 'PENDISPLAY',
			releaseYear: 2026,
		});
		if (result.status !== 'ok') throw new Error(result.status);
		const builder = await executeBuilderQuery(ds, {
			collection: 'Tablets',
			filters: result.filters,
			sorts: [{ field: 'Brand', direction: 'asc' }],
			columns: ['EntityId'],
			output: { mode: 'toArray' },
		});
		expect(builder).toEqual(result.tablets.map((tablet) => ({ EntityId: tablet.entityId })));
		expect(
			result.tablets.every(
				(tablet) => tablet.type === 'PENDISPLAY' && tablet.releaseYear === '2026',
			),
		).toBe(true);
		expect(result.count).toBe(result.tablets.length);
		expect(result.truncated).toBe(false);
		expect(parseFilterParams(new URL(result.url).searchParams)).toEqual(result.filters);
		expect(new URL(result.url).pathname).toBe('/DrawTabDataExplorer/tablets');
		expect(result.source.versionUrl).toBe(`${baseUrl}version.json`);
		expect(ctx.navigate).not.toHaveBeenCalled();
	});

	it('combines type and year with AND, excludes missing years, and does not stop at five', async () => {
		const seed = tablets[0];
		const fixture = (id: string, type: Tablet['Model']['Type'], year: string): Tablet => ({
			...seed,
			Meta: { ...seed.Meta, EntityId: `fixture.tablet.${id}` },
			Model: { ...seed.Model, Id: id, Type: type, ReleaseYear: year },
		});
		const matching = Array.from({ length: 7 }, (_, i) =>
			fixture(`display${i}`, 'PENDISPLAY', '2026'),
		);
		const records = [
			...matching,
			fixture('older', 'PENDISPLAY', '2025'),
			fixture('unknown', 'PENDISPLAY', ''),
			fixture('pen', 'PENTABLET', '2026'),
			fixture('standalone', 'STANDALONE', '2026'),
		];
		const tool = createQueryTabletsTool(context(records));
		const result = await tool.execute({ tabletType: 'PENDISPLAY', releaseYear: 2026 });
		if (result.status !== 'ok') throw new Error(result.status);
		expect(result.count).toBe(7);
		expect(result.tablets.map((tablet) => tablet.entityId)).toEqual(
			matching.map((tablet) => tablet.Meta.EntityId),
		);
		expect(await tool.execute({ releaseYear: 2026 })).toMatchObject({ count: 9 });
		expect(await tool.execute({ tabletType: 'PENDISPLAY' })).toMatchObject({ count: 9 });
	});

	it.each([
		null,
		{},
		[],
		{ tabletType: 'DISPLAY' },
		{ releaseYear: '2026' },
		{ releaseYear: 2026.5 },
		{ releaseYear: NaN },
		{ releaseYear: 0 },
		{ releaseYear: 10000 },
		{ releaseYear: 2026, brand: 'WACOM' },
		{ tabletType: 'PENTABLET', sortBy: 'bodySize' },
		{ sortDirection: 'desc' },
		{ sortBy: 'activeArea', sortDirection: 'down' },
	])('rejects unsupported or invalid input before loading: %j', async (input) => {
		const ctx = context();
		expect((await createQueryTabletsTool(ctx).execute(input)).status).toBe('invalid_input');
		expect(ctx.loadTablets).not.toHaveBeenCalled();
	});

	it('distinguishes zero matches from failed or empty data', async () => {
		const ctx = context();
		expect(await createQueryTabletsTool(ctx).execute({ releaseYear: 1000 })).toMatchObject({
			status: 'ok',
			count: 0,
			tablets: [],
			truncated: false,
		});
		ctx.loadTablets.mockRejectedValue(new Error('offline'));
		expect((await createQueryTabletsTool(ctx).execute({ releaseYear: 2026 })).status).toBe(
			'unavailable',
		);
		expect((await createQueryTabletsTool(context([])).execute({ releaseYear: 2026 })).status).toBe(
			'unavailable',
		);
	});
});

describe('active-area ranking', () => {
	it('breaks area ties by EntityId regardless of dataset order', async () => {
		const seed = tablets[0];
		const records = ['z', 'a', 'm'].map((id): Tablet => ({
			...seed,
			Meta: { ...seed.Meta, EntityId: `fixture.tablet.${id}` },
			Digitizer: { ...seed.Digitizer, Dimensions: { Width: 200, Height: 100 } },
		}));
		for (const sortDirection of ['asc', 'desc']) {
			const result = await createQueryTabletsTool(context(records)).execute({
				sortBy: 'activeArea',
				sortDirection,
			});
			if (result.status !== 'ok') throw new Error(result.status);
			expect(result.tablets.map((tablet) => tablet.entityId)).toEqual([
				'fixture.tablet.a',
				'fixture.tablet.m',
				'fixture.tablet.z',
			]);
		}
	});

	it('ranks by numeric area rather than width or diagonal, excluding unknown and zero area', async () => {
		const seed = tablets[0];
		const fixture = (
			id: string,
			width: number | undefined,
			height: number,
			type: Tablet['Model']['Type'] = 'PENTABLET',
		): Tablet => ({
			...seed,
			Meta: { ...seed.Meta, EntityId: `fixture.tablet.${id}` },
			Model: { ...seed.Model, Id: id, Type: type, Status: 'DISCONTINUED' },
			Digitizer: { ...seed.Digitizer, Dimensions: { Width: width, Height: height } },
		});
		const records = [
			fixture('long', 1000, 10),
			fixture('small', 10, 9),
			fixture('square', 200, 200),
			fixture('missing', undefined, 500),
			fixture('zero', 0, 500),
			fixture('display', 2000, 2000, 'PENDISPLAY'),
		];
		const tool = createQueryTabletsTool(context(records));
		const result = await tool.execute({ tabletType: 'PENTABLET', sortBy: 'activeArea' });
		if (result.status !== 'ok') throw new Error(result.status);
		expect(result.tablets.map((tablet) => tablet.modelId)).toEqual(['square', 'long', 'small']);
		expect(result.tablets.map((tablet) => tablet.activeArea?.areaMm2)).toEqual([40000, 10000, 90]);
		expect(result.ranking).toMatchObject({
			basis: 'active_area',
			direction: 'desc',
			excludedMissingArea: 2,
		});
		expect(result.tablets[0].modelStatus).toBe('DISCONTINUED');
		const ascending = await tool.execute({
			tabletType: 'PENTABLET',
			sortBy: 'activeArea',
			sortDirection: 'asc',
		});
		if (ascending.status !== 'ok') throw new Error(ascending.status);
		expect(ascending.tablets.map((tablet) => tablet.modelId)).toEqual(['small', 'long', 'square']);
	});

	it('keeps year filters and reproduces the ranking through list URLs and Query Builder', async () => {
		const result = await createQueryTabletsTool(context()).execute({
			tabletType: 'PENTABLET',
			releaseYear: 2025,
			sortBy: 'activeArea',
		});
		if (result.status !== 'ok') throw new Error(result.status);
		const params = new URL(result.url).searchParams;
		expect(parseFilterParams(params)).toEqual(result.filters);
		expect(parseSortParams(params)).toEqual(result.sorts);
		expect(parseColumnParams(params)).toContain('DigitizerActiveAreaCm2');
		const builder = await executeBuilderQuery(ds, {
			collection: 'Tablets',
			filters: result.filters,
			sorts: result.sorts,
			columns: ['EntityId', 'DigitizerActiveAreaMm2'],
			output: { mode: 'toArray' },
		});
		expect((builder as { EntityId: string }[]).map((row) => row.EntityId)).toEqual(
			result.tablets.map((tablet) => tablet.entityId),
		);
		expect(result.tablets.every((tablet) => tablet.releaseYear === '2025')).toBe(true);
		expect(result.count).toBe(result.tablets.length);
		expect(result.truncated).toBe(false);
	});
});

describe('opening a tablet query', () => {
	it('opens the filtered list and also returns its matches', async () => {
		const ctx = context();
		const result = await createOpenTabletQueryTool(ctx).execute({
			tabletType: 'PENDISPLAY',
			releaseYear: 2026,
		});
		if (result.status !== 'opened') throw new Error(result.status);
		expect(ctx.navigate).toHaveBeenCalledWith(result.url);
		expect(result.count).toBe(result.tablets.length);
	});

	it('does not navigate for invalid input or unavailable data', async () => {
		const ctx = context([]);
		const tool = createOpenTabletQueryTool(ctx);
		expect((await tool.execute({ unsupported: true })).status).toBe('invalid_input');
		expect((await tool.execute({ releaseYear: 2026 })).status).toBe('unavailable');
		expect(ctx.navigate).not.toHaveBeenCalled();
	});

	it('keeps valid results available when navigation fails', async () => {
		const ctx = context();
		ctx.navigate.mockRejectedValue(new Error('cancelled'));
		const result = await createOpenTabletQueryTool(ctx).execute({ releaseYear: 2026 });
		if (result.status !== 'navigation_failed') throw new Error(result.status);
		expect(result.count).toBe(result.tablets.length);
		expect(result.url).toContain('ModelReleaseYear');
	});
});
