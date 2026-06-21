import { describe, it, expect } from 'vitest';
import { buildTimelineRows, type TimelinePeriod } from './rows.js';
import type { Tablet, Pen, Driver } from '$data/lib/drawtab-loader.js';

const tablet = (id: string): Tablet =>
	({
		Meta: { EntityId: `wacom.tablet.${id.toLowerCase()}` },
		Model: { Brand: 'WACOM', Id: id, Name: `Tablet ${id}`, Type: 'PENTABLET' },
	}) as unknown as Tablet;

const pen = (id: string): Pen =>
	({
		EntityId: `wacom.pen.${id.toLowerCase()}`,
		Brand: 'WACOM',
		PenId: id,
		PenName: `Pen ${id}`,
	}) as unknown as Pen;

const driver = (ver: string, os: string): Driver =>
	({
		EntityId: `wacom.driver.${ver}_${os.toLowerCase()}`,
		Brand: 'WACOM',
		DriverVersion: ver,
		OSFamily: os,
	}) as unknown as Driver;

const period = (over: Partial<TimelinePeriod>): TimelinePeriod => ({
	sort: '2020',
	year: '2020',
	month: null,
	monthUnknown: false,
	tablets: [],
	pens: [],
	drivers: [],
	...over,
});

describe('buildTimelineRows', () => {
	it('flattens periods in order, tablets then pens then drivers within a period', () => {
		const rows = buildTimelineRows([
			period({
				sort: '2021',
				year: '2021',
				tablets: [tablet('A')],
				pens: [pen('P')],
				drivers: [driver('1.0', 'MACOS')],
			}),
			period({ sort: '2020', year: '2020', tablets: [tablet('B')] }),
		]);
		expect(rows.map((r) => [r.year, r.category, r.id])).toEqual([
			['2021', 'Tablet', 'A'],
			['2021', 'Pen', 'P'],
			['2021', 'Driver', ''],
			['2020', 'Tablet', 'B'],
		]);
	});

	it('maps fields per category (driver OS goes in detail, id blank)', () => {
		const [t, p, d] = buildTimelineRows([
			period({ tablets: [tablet('A')], pens: [pen('P')], drivers: [driver('6.4.0', 'WINDOWS')] }),
		]);
		expect(t).toMatchObject({
			category: 'Tablet',
			name: 'Tablet A',
			id: 'A',
			detail: 'PENTABLET',
			entityId: 'wacom.tablet.a',
		});
		expect(p).toMatchObject({ category: 'Pen', name: 'Pen P', id: 'P', detail: '' });
		expect(d).toMatchObject({ category: 'Driver', name: '6.4.0', id: '', detail: 'Windows' });
	});

	it('carries period month metadata onto rows and skips empty periods', () => {
		const rows = buildTimelineRows([
			period({ sort: '2020-03', year: '2020', month: 3, tablets: [tablet('A')] }),
			period({ sort: '2019', year: '2019' }), // empty → no rows
		]);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ year: '2020', month: 3, monthUnknown: false });
	});
});
