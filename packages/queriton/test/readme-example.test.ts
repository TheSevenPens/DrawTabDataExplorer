// Drift protection for the README's "Minimal example" code block.
// If anyone renames `registerCollection` → `register`, drops `.toArray()`,
// or otherwise changes the public surface the README documents, this
// test fails and points at the README as the thing that needs updating.
//
// The example in the README uses `fetchCarsFromSomewhere()` as a stub
// loader; here we substitute a tiny inline fixture so the test is
// runnable without external dependencies.

import { describe, it, expect } from 'vitest';
import { DataSet, type AnyFieldDef } from '../src/index.js';

interface Car {
	model: string;
	mpg: number;
	cyl: number;
}

const carFields: AnyFieldDef[] = [
	{
		key: 'model',
		label: 'Model',
		type: 'string',
		group: 'data',
		getValue: (c: Car) => c.model,
	},
	{
		key: 'mpg',
		label: 'MPG',
		type: 'number',
		group: 'data',
		getValue: (c: Car) => String(c.mpg),
	},
	{
		key: 'cyl',
		label: 'Cyl',
		type: 'number',
		group: 'data',
		getValue: (c: Car) => String(c.cyl),
	},
];

const inlineFixture: Car[] = [
	{ model: 'Toyota Corolla', mpg: 33.9, cyl: 4 },
	{ model: 'Fiat 128', mpg: 32.4, cyl: 4 },
	{ model: 'Honda Civic', mpg: 30.4, cyl: 4 },
	{ model: 'Lotus Europa', mpg: 30.4, cyl: 4 },
	{ model: 'Mazda RX4', mpg: 21.0, cyl: 6 },
	{ model: 'Camaro Z28', mpg: 13.3, cyl: 8 },
];

describe('README minimal example', () => {
	it('compiles and runs as documented', async () => {
		// ----- Begin README example (verbatim shape) -----
		const ds = new DataSet();
		ds.registerCollection<Car>('cars', async () => inlineFixture, carFields);

		const topMpg = await ds
			.get<Car>('cars')
			.filter('cyl', '==', 4)
			.sort('mpg', 'desc')
			.take(3)
			.toArray();
		// ----- End README example -----

		expect(topMpg).toHaveLength(3);
		expect(topMpg.map((c) => c.model)).toEqual([
			'Toyota Corolla',
			'Fiat 128',
			'Honda Civic', // ties broken by input order (stable sort) — Lotus stringifies the same '30.4'
		]);
	});
});
