import { beforeAll, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { createDiskDataSet } from '$data/lib/dataset-node.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { createTabletSpecsTool, lookupTabletSpecs } from './tablet-specs.js';

const baseUrl = 'https://thesevenpens.github.io/DrawTabDataExplorer/';
let tablets: Tablet[];
let intuos: Tablet;
beforeAll(async () => {
	const ds = createDiskDataSet({ dataDir: path.resolve('data-repo/data'), userId: 'sevenpens' });
	tablets = await ds.Tablets.toArray();
	intuos = tablets.find((t) => t.Meta.EntityId === 'wacom.tablet.ctl4100')!;
});

describe('tablet specs lookup', () => {
	it.each([
		'CTL-4100',
		'ctl4100',
		'Wacom CTL-4100',
		'WACOM.TABLET.CTL4100',
		'Wacom Intuos Small (CTL-4100)',
	])('resolves %s without selecting the Bluetooth variant', (query) => {
		const result = lookupTabletSpecs(tablets, query, baseUrl);
		expect(result.status).toBe('found');
		if (result.status !== 'found') throw new Error(result.status);
		expect(result.tablet.entityId).toBe('wacom.tablet.ctl4100');
		expect(result.tablet.url).toBe(`${baseUrl}entity/wacom.tablet.ctl4100`);
	});

	it('preserves zero, NO, missing and not-applicable as different facts', () => {
		const result = lookupTabletSpecs(tablets, 'ctl4100', baseUrl);
		if (result.status !== 'found') throw new Error(result.status);
		const field = (key: string) => result.specs.find((f) => f.key === key);
		expect(field('DigitizerPressureLevels')).toMatchObject({ value: 4096, status: 'recorded' });
		expect(field('DigitizerTilt')).toMatchObject({ value: 0, status: 'recorded' });
		expect(field('OtherInputsTouch')).toMatchObject({ value: 'NO', status: 'recorded' });
		expect(field('DigitizerMaxHover')).toMatchObject({ value: null, status: 'not_recorded' });
		expect(field('DisplayBrightness')).toMatchObject({ value: null, status: 'not_applicable' });
		expect(field('DigitizerDimensions')).toMatchObject({ value: '152 x 95', unit: 'mm' });
		expect(field('DigitizerActiveAreaMm2')).toMatchObject({
			value: 14440,
			unit: 'mm²',
			computed: true,
		});
		expect(field('UnitsInInventory')).toBeUndefined();
		expect(result.specs.some((f) => f.group === 'Standalone')).toBe(false);
		// Connectivity applies to every tablet type, so a pen tablet still reports it.
		expect(field('ConnectivityPorts')).toMatchObject({
			group: 'Connectivity',
			value: null,
			status: 'not_recorded',
		});
	});

	it('reports Connectivity on a pen tablet and on a standalone', () => {
		const pth660 = lookupTabletSpecs(tablets, 'wacom.tablet.pth660', baseUrl);
		if (pth660.status !== 'found') throw new Error(pth660.status);
		const field = (key: string) => pth660.specs.find((f) => f.key === key);
		expect(field('ConnectivityPorts')).toMatchObject({ value: 'USB-C', status: 'recorded' });
		expect(field('ConnectivityAttachedCable')).toMatchObject({ value: 'None', status: 'recorded' });
		expect(field('ConnectivityBluetooth')).toMatchObject({ value: 'YES', status: 'recorded' });
		expect(field('ConnectivityBluetoothVersion')).toMatchObject({ status: 'not_recorded' });

		const msp = lookupTabletSpecs(tablets, 'wacom.tablet.dthw1621', baseUrl);
		if (msp.status !== 'found') throw new Error(msp.status);
		expect(msp.specs.find((f) => f.key === 'ConnectivityPorts')).toMatchObject({
			value: 'USB-C (USB 3.1), USB-C (Thunderbolt 3), USB-C (Thunderbolt 3)',
		});
		expect(msp.specs.find((f) => f.key === 'ConnectivityBluetoothVersion')).toMatchObject({
			value: '5.0',
		});
	});

	it('returns bounded candidates for a broad name instead of guessing', () => {
		const result = lookupTabletSpecs(tablets, 'wacom', baseUrl);
		if (result.status !== 'ambiguous') throw new Error(result.status);
		expect(result.totalMatches).toBeGreaterThan(10);
		expect(result.truncated).toBe(true);
		expect(result.candidates).toHaveLength(10);
		expect(lookupTabletSpecs(tablets, result.candidates[0].entityId, baseUrl).status).toBe('found');
	});

	it('distinguishes generations that share the Intuos Small name', () => {
		const result = lookupTabletSpecs(tablets, 'Wacom Intuos Small', baseUrl);
		if (result.status !== 'ambiguous') throw new Error(result.status);
		expect(result.candidates.map((t) => t.entityId)).toEqual([
			'wacom.tablet.ctl4100',
			'wacom.tablet.ctl490',
		]);
	});

	it('supports alternate names and preserves ambiguity between identical names', () => {
		const alias = { ...intuos, Model: { ...intuos.Model, AlternateNames: ['Little Board'] } };
		expect(lookupTabletSpecs([alias], 'Little Board', baseUrl).status).toBe('found');
		const duplicate = {
			...alias,
			Meta: { ...alias.Meta, EntityId: 'wacom.tablet.other' },
			Model: { ...alias.Model, Id: 'other' },
		};
		expect(lookupTabletSpecs([alias, duplicate], 'Little Board', baseUrl).status).toBe('ambiguous');
	});

	it('does not use measurements as name matches or convert absent dimensions to zero', () => {
		expect(lookupTabletSpecs([intuos], '152', baseUrl).status).toBe('not_found');
		const result = lookupTabletSpecs([{ ...intuos, Digitizer: undefined }], 'ctl4100', baseUrl);
		if (result.status !== 'found') throw new Error(result.status);
		expect(result.specs.find((f) => f.key === 'DigitizerActiveAreaMm2')).toMatchObject({
			value: null,
			status: 'not_recorded',
		});
	});
});

describe('WebMCP tool execution', () => {
	it.each([
		null,
		{},
		[],
		{ query: '' },
		{ query: '   ' },
		{ query: 7 },
		{ query: 'a'.repeat(201) },
		{ query: 'ctl4100', extra: true },
	])('rejects invalid input before loading data: %j', async (input) => {
		const loadTablets = vi.fn();
		const tool = createTabletSpecsTool({ loadTablets, baseUrl, version: null });
		expect(await tool.execute(input)).toMatchObject({ status: 'invalid_input' });
		expect(loadTablets).not.toHaveBeenCalled();
	});

	it('loads on demand and returns source metadata without changing the dataset', async () => {
		const before = JSON.stringify(intuos);
		const loadTablets = vi.fn(async () => [intuos]);
		const tool = createTabletSpecsTool({ loadTablets, baseUrl, version: null });
		expect(loadTablets).not.toHaveBeenCalled();
		expect(await tool.execute({ query: '  CTL-4100  ' })).toMatchObject({
			status: 'found',
			source: { versionUrl: `${baseUrl}version.json`, commit: null },
		});
		expect(JSON.stringify(intuos)).toBe(before);
	});

	it('reports failed and empty datasets as unavailable, not no matches', async () => {
		for (const loadTablets of [
			async (): Promise<Tablet[]> => {
				throw new Error('offline');
			},
			async () => [],
		]) {
			expect(
				await createTabletSpecsTool({ loadTablets, baseUrl, version: null }).execute({
					query: 'ctl4100',
				}),
			).toMatchObject({ status: 'unavailable' });
		}
	});
});
