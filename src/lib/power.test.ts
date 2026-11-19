import { describe, expect, it } from 'vitest';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import {
	inputSourceRows,
	NOT_RECORDED,
	powerCoverage,
	powerSourceLabel,
	powerSpecBlocks,
	ratedInputWatts,
	ratedInputWattsComputed,
	standbyWatts,
} from './power.js';

const tab = (Power?: Record<string, string>, Type = 'PENDISPLAY') =>
	({ Model: { Type }, Power }) as unknown as Tablet;

describe('ratedInputWatts', () => {
	it('is voltage × current, without float noise', () => {
		expect(ratedInputWatts(tab({ InputVoltage: '5', InputCurrent: '0.036' }))).toBe(0.18);
		expect(ratedInputWatts(tab({ InputVoltage: '19', InputCurrent: '3.42' }))).toBe(64.98);
	});

	it('prefers the stated input watts', () => {
		const t = tab({ InputVoltage: '5', InputCurrent: '3', InputWatts: '15' });
		expect(ratedInputWatts(t)).toBe(15);
		expect(ratedInputWattsComputed(t)).toBe(false);
	});

	it('is null for a voltage without a current, and ignores consumption', () => {
		expect(ratedInputWatts(tab({ InputVoltage: '12', ConsumptionMaxWatts: '30' }))).toBeNull();
		expect(ratedInputWatts(tab())).toBeNull();
		expect(ratedInputWattsComputed(tab({ InputVoltage: '12' }))).toBe(false);
	});
});

describe('value readers', () => {
	it('treat blank and missing as null, never 0', () => {
		expect(standbyWatts(tab({ StandbyWatts: '' }))).toBeNull();
		expect(standbyWatts(tab())).toBeNull();
		expect(standbyWatts(tab({ StandbyWatts: '0.5' }))).toBe(0.5);
	});
});

describe('powerSourceLabel', () => {
	it('names each stored code and passes unknown ones through', () => {
		expect(powerSourceLabel('USB_PD')).toBe('USB-C Power Delivery');
		expect(powerSourceLabel('ADAPTER')).toBe('Power adapter');
		expect(powerSourceLabel('OTHER')).toBe('OTHER');
	});
});

describe('powerCoverage', () => {
	it('counts each pool separately', () => {
		const rows = powerCoverage(
			[tab({ InputSource: 'USB', InputVoltage: '5', InputCurrent: '0.5' }, 'PENTABLET'), tab()],
			[tab({ StandbyWatts: '0.3' })],
		);
		const by = Object.fromEntries(rows.map((r) => [r.label, [r.penTablets, r.penDisplays]]));
		expect(by['Any power data']).toEqual([1, 1]);
		expect(by['Rated input watts (stated or V × A)']).toEqual([1, 0]);
		expect(by['Standby']).toEqual([0, 1]);
	});
});

describe('inputSourceRows', () => {
	it('orders by source with the unrecorded last, labelled for readers', () => {
		const rows = inputSourceRows([
			tab(),
			tab({ InputSource: 'USB' }),
			tab({ InputSource: 'ADAPTER' }),
			tab({ InputSource: 'USB' }),
		]);
		expect(rows).toEqual([
			{ label: 'Power adapter', count: 1 },
			{ label: 'USB port', count: 2 },
			{ label: NOT_RECORDED, count: 1 },
		]);
	});
});

describe('powerSpecBlocks', () => {
	it('keeps input rating and consumption in separate blocks, dropping empty ones', () => {
		const blocks = powerSpecBlocks(
			tab({
				InputSource: 'ADAPTER',
				InputVoltage: '12',
				InputCurrent: '2',
				ConsumptionMaxWatts: '18',
				StandbyWatts: '0.5',
			}),
		);
		expect(blocks.map((b) => b.heading)).toEqual(['Input rating', 'Consumption']);
		expect(blocks[0].rows.map((r) => [r.label, r.value, r.computed ?? false])).toEqual([
			['Source', 'Power adapter', false],
			['Voltage', '12', false],
			['Current', '2', false],
			['Power', '24', true],
		]);
		expect(blocks[1].rows.map((r) => r.label)).toEqual(['Maximum', 'Standby']);
	});

	it('is empty without power data', () => {
		expect(powerSpecBlocks(tab())).toEqual([]);
	});
});

describe('powerSpecBlocks alternative input', () => {
	it('computes the alternative input watts', () => {
		const [, alt] = powerSpecBlocks(
			tab({
				InputSource: 'USB_PD',
				InputVoltage: '5',
				InputCurrent: '3',
				AltInputSource: 'ADAPTER',
				AltInputVoltage: '9',
				AltInputCurrent: '2.77',
			}),
		);
		expect(alt.heading).toBe('Alternative input');
		expect(alt.rows.at(-1)).toMatchObject({ label: 'Power', value: '24.93', computed: true });
	});
});
