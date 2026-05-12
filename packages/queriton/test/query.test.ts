// Standalone verb-coverage tests for the queriton Query<T> API.
// No filesystem or network — every fixture is embedded TypeScript.
//
// Coverage parity with data-repo/lib/dataset.test.ts for the generic
// verbs (filter / sort / select / derive / summarize / joins /
// unroll / concat / keyBy / distinct, etc.). Null-handling lives in
// nulls.test.ts.

import { describe, it, expect } from 'vitest';
import { Query } from '../src/index.js';
import { mtcars, mtcarsFields, type Car } from './fixtures/mtcars.js';
import {
	customers,
	customerFields,
	orders,
	orderFields,
	type Customer,
	type Order,
} from './fixtures/orders-customers.js';
import { people, peopleFields, type Person } from './fixtures/people-hobbies.js';

// Helper — wraps the fixture in a Query without any pipeline steps.
function carsQ(): Query<Car> {
	return new Query<Car>(async () => mtcars, mtcarsFields);
}
function customersQ(): Query<Customer> {
	return new Query<Customer>(async () => customers, customerFields);
}
function ordersQ(): Query<Order> {
	return new Query<Order>(async () => orders, orderFields);
}
function peopleQ(): Query<Person> {
	return new Query<Person>(async () => people, peopleFields);
}

describe('Query — materialisation', () => {
	it('toArray returns the full collection', async () => {
		expect((await carsQ().toArray()).length).toBe(32);
	});

	it('count matches toArray length', async () => {
		expect(await carsQ().count()).toBe(32);
	});

	it('find returns the first match', async () => {
		const car = await carsQ().find((c) => c.model === 'Volvo 142E');
		expect(car?.mpg).toBe(21.4);
	});

	it('find returns undefined when nothing matches', async () => {
		expect(await carsQ().find((c) => c.model === 'Nope')).toBeUndefined();
	});
});

describe('Query — toSteps (pipeline introspection)', () => {
	it('returns an empty list for an unmodified Query', () => {
		expect(carsQ().toSteps()).toEqual([]);
	});

	it('returns each step in pipeline order', () => {
		const q = carsQ().filter('cyl', '==', 4).sort('mpg', 'desc').take(5);
		expect(q.toSteps()).toEqual([
			{ kind: 'filter', field: 'cyl', operator: '==', value: '4' },
			{ kind: 'sort', field: 'mpg', direction: 'desc' },
			{ kind: 'take', count: 5 },
		]);
	});

	it('returns a defensive copy (mutating the result does not affect the Query)', () => {
		const q = carsQ().filter('cyl', '==', 4);
		const steps = q.toSteps();
		steps.push({ kind: 'reverse' });
		expect(q.toSteps()).toHaveLength(1);
	});
});

describe('Query — filter operators', () => {
	it("'==' matches exact string values", async () => {
		const rows = await carsQ().filter('model', '==', 'Mazda RX4').toArray();
		expect(rows).toHaveLength(1);
		expect(rows[0].mpg).toBe(21.0);
	});

	it("'!=' excludes matches", async () => {
		const rows = await carsQ().filter('cyl', '!=', 8).count();
		expect(rows).toBe(32 - mtcars.filter((c) => c.cyl === 8).length);
	});

	it("'contains' is case-insensitive", async () => {
		const u = await carsQ().filter('model', 'contains', 'MERC').count();
		const l = await carsQ().filter('model', 'contains', 'merc').count();
		const m = await carsQ().filter('model', 'contains', 'Merc').count();
		expect(u).toBeGreaterThan(0);
		expect(u).toBe(l);
		expect(u).toBe(m);
	});

	it("'notcontains' is the complement of contains", async () => {
		const c = await carsQ().filter('model', 'contains', 'merc').count();
		const nc = await carsQ().filter('model', 'notcontains', 'merc').count();
		expect(c + nc).toBe(32);
	});

	it("'startswith' anchors to the prefix (case-insensitive)", async () => {
		const rows = await carsQ().filter('model', 'startswith', 'merc').toArray();
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((c) => c.model.toLowerCase().startsWith('merc'))).toBe(true);
	});

	it("'notstartswith' is the complement of startswith", async () => {
		const s = await carsQ().filter('model', 'startswith', 'merc').count();
		const ns = await carsQ().filter('model', 'notstartswith', 'merc').count();
		expect(s + ns).toBe(32);
	});

	it('numeric > and < bracket the dataset', async () => {
		const hi = await carsQ().filter('mpg', '>', 25).toArray();
		expect(hi.length).toBeGreaterThan(0);
		expect(hi.every((c) => c.mpg > 25)).toBe(true);

		const lo = await carsQ().filter('mpg', '<', 15).toArray();
		expect(lo.every((c) => c.mpg < 15)).toBe(true);
	});

	it('numeric >= and <= are inclusive', async () => {
		const ge = await carsQ().filter('cyl', '>=', 6).count();
		const gt = await carsQ().filter('cyl', '>', 6).count();
		const eq = await carsQ().filter('cyl', '==', 6).count();
		expect(ge).toBe(gt + eq);
	});

	it("'in' matches any of the listed values (pipe-separated)", async () => {
		const both = await carsQ().filter('cyl', 'in', '4|8').count();
		const a = await carsQ().filter('cyl', '==', 4).count();
		const b = await carsQ().filter('cyl', '==', 8).count();
		expect(both).toBe(a + b);
	});

	it("'notin' is the complement of 'in'", async () => {
		const inSet = await carsQ().filter('cyl', 'in', '4|8').count();
		const out = await carsQ().filter('cyl', 'notin', '4|8').count();
		expect(inSet + out).toBe(32);
	});

	it("'between' is inclusive at both ends", async () => {
		const rows = await carsQ().filter('mpg', 'between', '20|25').toArray();
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((c) => c.mpg >= 20 && c.mpg <= 25)).toBe(true);
	});

	it("'containsStrict' is case-sensitive", async () => {
		const ci = await carsQ().filter('model', 'contains', 'merc').count();
		const cs = await carsQ().filter('model', 'containsStrict', 'merc').count();
		const csU = await carsQ().filter('model', 'containsStrict', 'Merc').count();
		expect(ci).toBeGreaterThan(0);
		expect(cs).toBe(0);
		expect(csU).toBeGreaterThan(0);
	});
});

describe('Query — filter forms', () => {
	it('predicate function applies an arbitrary check', async () => {
		const rows = await carsQ()
			.filter((c) => c.hp > 200)
			.toArray();
		expect(rows.every((c) => c.hp > 200)).toBe(true);
	});

	it('OR matches rows satisfying any clause', async () => {
		const either = await carsQ()
			.filter({
				or: [
					{ field: 'cyl', op: '==', value: '4' },
					{ field: 'cyl', op: '==', value: '8' },
				],
			})
			.count();
		const four = await carsQ().filter('cyl', '==', 4).count();
		const eight = await carsQ().filter('cyl', '==', 8).count();
		expect(either).toBe(four + eight);
	});

	it('AND nests inside OR', async () => {
		const rows = await carsQ()
			.filter({
				or: [
					{
						and: [
							{ field: 'cyl', op: '==', value: '8' },
							{ field: 'am', op: '==', value: '1' },
						],
					},
					{ field: 'gear', op: '==', value: '5' },
				],
			})
			.toArray();
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((c) => (c.cyl === 8 && c.am === 1) || c.gear === 5)).toBe(true);
	});

	it('NOT inverts its sub-expression', async () => {
		const notV8 = await carsQ()
			.filter({ not: { field: 'cyl', op: '==', value: '8' } })
			.count();
		const v8 = await carsQ().filter('cyl', '==', 8).count();
		expect(notV8).toBe(32 - v8);
	});

	it('filterIn matches any of the listed values', async () => {
		const rows = await carsQ().filterIn('cyl', [4, 8]).toArray();
		expect(rows.every((c) => c.cyl === 4 || c.cyl === 8)).toBe(true);
	});

	it('filterNotIn excludes the listed values', async () => {
		const inSet = await carsQ().filterIn('cyl', [4, 8]).count();
		const out = await carsQ().filterNotIn('cyl', [4, 8]).count();
		expect(inSet + out).toBe(32);
	});
});

describe('Query — sort', () => {
	it('asc orders ascending', async () => {
		const sorted = await carsQ().sort('mpg').toArray();
		const mpgs = sorted.map((c) => c.mpg);
		// Note: getValue stringifies, so sort is lexicographic — pin that.
		expect(mpgs).toEqual([...mpgs].sort((a, b) => String(a).localeCompare(String(b))));
	});

	it('desc reverses the order', async () => {
		const asc = await carsQ().sort('model', 'asc').toArray();
		const desc = await carsQ().sort('model', 'desc').toArray();
		expect(desc.map((c) => c.model)).toEqual([...asc.map((c) => c.model)].reverse());
	});

	it('multi-key array sort is primary-by-first', async () => {
		// Primary asc on cyl, secondary desc on mpg within each cyl group.
		const rows = await carsQ()
			.sort([
				{ field: 'cyl', direction: 'asc' },
				{ field: 'mpg', direction: 'desc' },
			])
			.toArray();
		// All 4-cyl cars come first, then 6, then 8.
		const cyls = rows.map((c) => c.cyl);
		const first8 = cyls.indexOf(8);
		const last4 = cyls.lastIndexOf(4);
		expect(last4).toBeLessThan(first8);
		// Within 4-cyl, mpg is descending.
		const mpgs4 = rows.filter((c) => c.cyl === 4).map((c) => c.mpg);
		expect(mpgs4).toEqual([...mpgs4].sort((a, b) => b - a));
	});
});

describe('Query — pagination', () => {
	it('take limits the result count', async () => {
		expect(await carsQ().take(5).count()).toBe(5);
	});

	it('skip drops the first N rows', async () => {
		const all = await carsQ().sort('model').toArray();
		const skipped = await carsQ().sort('model').skip(10).toArray();
		expect(skipped.length).toBe(all.length - 10);
		expect(skipped[0]).toEqual(all[10]);
	});

	it('skip + take is a paged window', async () => {
		const p1 = await carsQ().sort('model').take(5).toArray();
		const p2 = await carsQ().sort('model').skip(5).take(5).toArray();
		expect(p2[0]).not.toEqual(p1[0]);
		expect(p2.length).toBe(5);
	});

	it('last keeps the trailing N rows in input order', async () => {
		const all = await carsQ().sort('model').toArray();
		const tail = await carsQ().sort('model').last(3).toArray();
		expect(tail).toEqual(all.slice(-3));
	});

	it('reverse flips order without re-sorting', async () => {
		const head = await carsQ().take(5).toArray();
		const rev = await carsQ().take(5).reverse().toArray();
		expect(rev).toEqual([...head].reverse());
	});
});

describe('Query — select (project)', () => {
	it('projects rows to only the requested fields', async () => {
		const rows = await carsQ().select(['model', 'mpg']).take(3).toArray();
		expect(rows).toHaveLength(3);
		for (const r of rows) {
			expect(Object.keys(r).sort()).toEqual(['model', 'mpg']);
		}
	});

	it('downstream sort/filter target projected columns', async () => {
		const rows = await carsQ().select(['model', 'mpg']).sort('mpg', 'desc').take(5).toArray();
		const mpgs = rows.map((r) => Number(r.mpg));
		expect(mpgs).toEqual([...mpgs].sort((a, b) => b - a));
	});

	it('unknown fields degrade to empty strings', async () => {
		const rows = await carsQ().select(['model', 'NotAField']).take(1).toArray();
		expect(rows[0].NotAField).toBe('');
	});
});

describe('Query — distinct / values', () => {
	it('returns sorted distinct non-empty values', async () => {
		const cyls = await carsQ().distinct('cyl');
		// Natural sort places "4" before "6" before "8".
		expect(cyls).toEqual(['4', '6', '8']);
	});

	it('values is a synonym for distinct', async () => {
		expect(await carsQ().values('cyl')).toEqual(await carsQ().distinct('cyl'));
	});

	it('composes with upstream filters', async () => {
		const gears = await carsQ().filter('cyl', '==', 4).distinct('gear');
		// Among 4-cylinder cars, gears observed are 3, 4, 5.
		expect(gears).toEqual(['3', '4', '5']);
	});
});

describe('Query — summarize', () => {
	it('count groups by one field and totals to the row count', async () => {
		const rows = await carsQ().summarize({ by: 'cyl', count: true }).toArray();
		const total = rows.reduce((s, r) => s + (r.count as number), 0);
		expect(total).toBe(32);
	});

	it('count column accepts a custom name', async () => {
		const rows = await carsQ().summarize({ by: 'cyl', count: 'n' }).toArray();
		expect(rows[0]).toHaveProperty('n');
		expect(rows[0]).not.toHaveProperty('count');
	});

	it('multi-field groupBy produces one row per distinct combination', async () => {
		const rows = await carsQ()
			.summarize({ by: ['cyl', 'gear'], count: 'n' })
			.toArray();
		const keys = rows.map((r) => `${r.cyl}|${r.gear}`);
		expect(new Set(keys).size).toBe(keys.length);
		expect(rows.reduce((s, r) => s + (r.n as number), 0)).toBe(32);
	});

	it('sum / avg / min / max read field values via FieldDef', async () => {
		const rows = await carsQ()
			.filter('cyl', '==', 4)
			.summarize({
				by: 'cyl',
				sum: { sumMpg: 'mpg' },
				avg: { avgMpg: 'mpg' },
				min: { minMpg: 'mpg' },
				max: { maxMpg: 'mpg' },
			})
			.toArray();
		expect(rows).toHaveLength(1);
		const r = rows[0];
		const fourCyl = mtcars.filter((c) => c.cyl === 4).map((c) => c.mpg);
		const expectedSum = fourCyl.reduce((s, m) => s + m, 0);
		expect(r.sumMpg).toBeCloseTo(expectedSum, 4);
		expect(r.avgMpg).toBeCloseTo(expectedSum / fourCyl.length, 4);
		expect(r.minMpg).toBe(Math.min(...fourCyl));
		expect(r.maxMpg).toBe(Math.max(...fourCyl));
	});

	it('median is the middle (even count → mean of middle two)', async () => {
		// Three 4-cyl gears: 3, 4, 5 — but median is over mpg, which has
		// many values. Just sanity-check it sits inside min/max.
		const rows = await carsQ()
			.filter('cyl', '==', 4)
			.summarize({ by: 'cyl', median: { medMpg: 'mpg' } })
			.toArray();
		const fourCyl = mtcars.filter((c) => c.cyl === 4).map((c) => c.mpg);
		const m = rows[0].medMpg as number;
		expect(m).toBeGreaterThanOrEqual(Math.min(...fourCyl));
		expect(m).toBeLessThanOrEqual(Math.max(...fourCyl));
	});

	it('first and last read raw values in input order', async () => {
		const rows = await carsQ()
			.filter('cyl', '==', 4)
			.summarize({
				by: 'cyl',
				first: { firstModel: 'model' },
				last: { lastModel: 'model' },
			})
			.toArray();
		const fourCyl = mtcars.filter((c) => c.cyl === 4);
		expect(rows[0].firstModel).toBe(fourCyl[0].model);
		expect(rows[0].lastModel).toBe(fourCyl[fourCyl.length - 1].model);
	});

	it('distinctCount counts unique non-empty values per group', async () => {
		const rows = await carsQ()
			.summarize({ by: 'cyl', distinctCount: { gears: 'gear' } })
			.toArray();
		for (const r of rows) {
			const cars = mtcars.filter((c) => String(c.cyl) === r.cyl);
			const expected = new Set(cars.map((c) => c.gear)).size;
			expect(r.gears).toBe(expected);
		}
	});

	it('collect returns the per-group array of raw values', async () => {
		const rows = await carsQ()
			.filter('cyl', '==', 4)
			.summarize({ by: 'cyl', collect: { models: 'model' } })
			.toArray();
		expect(Array.isArray(rows[0].models)).toBe(true);
		expect((rows[0].models as string[]).length).toBe(mtcars.filter((c) => c.cyl === 4).length);
	});

	it('summarize with no groupBy is a single all-rows summary', async () => {
		const rows = await carsQ().summarize({ count: 'n' }).toArray();
		expect(rows).toHaveLength(1);
		expect(rows[0].n).toBe(32);
	});

	it('summarize runs after upstream filters', async () => {
		const rows = await carsQ()
			.filter('cyl', '==', 8)
			.summarize({ by: 'gear', count: 'n' })
			.toArray();
		const eight = mtcars.filter((c) => c.cyl === 8).length;
		expect(rows.reduce((s, r) => s + (r.n as number), 0)).toBe(eight);
	});

	it('chains with sort + take (top-N)', async () => {
		const top2 = await carsQ()
			.summarize({ by: 'cyl', count: 'n' })
			.sort('n', 'desc')
			.take(2)
			.toArray();
		expect(top2).toHaveLength(2);
		const counts = top2.map((r) => r.n as number);
		expect(counts).toEqual([...counts].sort((a, b) => b - a));
	});

	it('unknown groupBy field collapses to a single empty-key group', async () => {
		const rows = await carsQ().summarize({ by: 'NotAField', count: 'n' }).toArray();
		expect(rows).toHaveLength(1);
		expect(rows[0].NotAField).toBe('');
		expect(rows[0].n).toBe(32);
	});

	it('unknown aggregator field yields 0', async () => {
		const rows = await carsQ()
			.summarize({ by: 'cyl', sum: { weird: 'NotAField' } })
			.toArray();
		expect(rows.every((r) => r.weird === 0)).toBe(true);
	});
});

describe('Query — derive', () => {
	it('adds a computed column usable downstream', async () => {
		const rows = await carsQ()
			.derive({ kmPerLitre: (c) => c.mpg * 0.425144 })
			.filter('cyl', '==', 4)
			.toArray();
		expect(rows.every((r) => typeof r.kmPerLitre === 'number')).toBe(true);
	});

	it('derived columns can be sorted on', async () => {
		const rows = await carsQ()
			.derive({ powerToWeight: (c) => c.hp / c.wt })
			.sort('powerToWeight', 'desc')
			.take(1)
			.toArray();
		// Maserati Bora has the highest hp/wt in the dataset.
		expect(rows[0].model).toBe('Maserati Bora');
	});

	it('derived columns flow into summarize', async () => {
		const rows = await carsQ()
			.derive({ category: (c) => (c.mpg > 25 ? 'eff' : c.mpg > 15 ? 'mid' : 'gas') })
			.summarize({ by: 'category', count: 'n' })
			.toArray();
		const sum = rows.reduce((s, r) => s + (r.n as number), 0);
		expect(sum).toBe(32);
	});
});

describe('Query — joins', () => {
	it('inner join merges right-side columns into matched rows', async () => {
		const joined = await ordersQ().join(customersQ(), 'customerId', 'customerId').toArray();
		// Only the 4 orders whose customerId matches.
		expect(joined).toHaveLength(4);
		for (const r of joined as Array<Record<string, unknown>>) {
			expect(typeof r.name).toBe('string'); // right-side field present
			expect(typeof r.amount).toBe('number'); // left-side field present
		}
	});

	it('semijoin keeps left rows with a match, no field merge', async () => {
		const rows = await ordersQ().semijoin(customersQ(), 'customerId', 'customerId').toArray();
		expect(rows).toHaveLength(4);
		for (const r of rows) {
			expect('name' in r).toBe(false); // no right-side fields merged
			expect(typeof r.amount).toBe('number');
		}
	});

	it('antijoin keeps left rows with no match (complement of semijoin)', async () => {
		const a = await ordersQ().antijoin(customersQ(), 'customerId', 'customerId').toArray();
		expect(a).toHaveLength(2);
		expect(a.map((o) => o.orderId).sort()).toEqual(['105', '106']);
	});

	it('semi + anti partition the left side', async () => {
		const total = await ordersQ().count();
		const semi = await ordersQ().semijoin(customersQ(), 'customerId', 'customerId').count();
		const anti = await ordersQ().antijoin(customersQ(), 'customerId', 'customerId').count();
		expect(semi + anti).toBe(total);
	});

	it('leftjoin keeps all left rows; matches get right-side fields', async () => {
		const rows = await ordersQ().leftjoin(customersQ(), 'customerId', 'customerId').toArray();
		expect(rows).toHaveLength(6);
		const withName = rows.filter((r) => typeof (r as Record<string, unknown>).name === 'string');
		expect(withName).toHaveLength(4);
	});
});

describe('Query — concat / union', () => {
	it('appends rows from another Query (UNION ALL semantics)', async () => {
		const fourCyl = carsQ().filter('cyl', '==', 4);
		const eightCyl = carsQ().filter('cyl', '==', 8);
		const combined = await fourCyl.concat(eightCyl).count();
		const a = mtcars.filter((c) => c.cyl === 4).length;
		const b = mtcars.filter((c) => c.cyl === 8).length;
		expect(combined).toBe(a + b);
	});

	it('union is a synonym for concat', async () => {
		const a = await carsQ()
			.filter('cyl', '==', 4)
			.concat(carsQ().filter('cyl', '==', 8))
			.count();
		const b = await carsQ()
			.filter('cyl', '==', 4)
			.union(carsQ().filter('cyl', '==', 8))
			.count();
		expect(b).toBe(a);
	});
});

describe('Query — unroll', () => {
	it('explodes an array-valued column into one row per element', async () => {
		// Lift hobbies to a top-level column via derive (keeping null as null,
		// not coercing to []), then unroll.
		const rows = await peopleQ()
			.derive({ hobby: (p) => p.hobbies as unknown as string })
			.unroll('hobby')
			.toArray();
		// Alice 3 + Bob 2 + Dana 1 elements, Charlie [] dropped, Eve null passes through = 7.
		expect(rows.length).toBe(3 + 2 + 1 + 1);
		// Eve's row passes through unchanged (non-array → passthrough rule).
		const eveRows = rows.filter((r) => (r as Record<string, unknown>).name === 'Eve');
		expect(eveRows).toHaveLength(1);
	});

	it('drops rows whose array is empty', async () => {
		const rows = await peopleQ()
			.derive({ hobby: (p) => p.hobbies as unknown as string })
			.unroll('hobby')
			.toArray();
		const charlie = rows.filter((r) => (r as Record<string, unknown>).name === 'Charlie');
		expect(charlie).toHaveLength(0);
	});
});

describe('Query — keyBy / collectBy', () => {
	it('keyBy returns a record keyed by field value', async () => {
		const byModel = await carsQ().keyBy('model');
		expect(byModel['Mazda RX4'].mpg).toBe(21.0);
		expect(byModel['Volvo 142E'].mpg).toBe(21.4);
	});

	it('collectBy buckets rows per key', async () => {
		const byCyl = await carsQ().collectBy('cyl');
		expect(byCyl['4'].length).toBe(mtcars.filter((c) => c.cyl === 4).length);
		expect(byCyl['8'].every((c) => c.cyl === 8)).toBe(true);
	});

	it('keyBy works after a summarize (post-transform field access)', async () => {
		const byCyl = await carsQ().summarize({ by: 'cyl', count: 'n' }).keyBy('cyl');
		expect((byCyl['4'] as { n: number }).n).toBe(mtcars.filter((c) => c.cyl === 4).length);
	});

	it('keyBy: last row wins on collision', async () => {
		// Group every car under cyl=4|6|8 — keyBy then keeps only the last
		// row per cyl key. The last 4-cyl in input order is Volvo 142E.
		const byCyl = await carsQ().keyBy('cyl');
		expect(byCyl['4'].model).toBe('Volvo 142E');
	});

	// --- Field-resolution edge cases (regression coverage for #138) ---

	it('keyBy: a .derive() that shadows an existing FieldDef key uses the derived value', async () => {
		// Before #138 was fixed: this would key by the original 'model' field
		// (the FieldDef path) instead of the derived value, because the
		// step-kind heuristic missed `derive` as a shape-changing step.
		const byModel = await carsQ()
			.derive({ model: (c) => `x-${c.model}` })
			.keyBy('model');
		expect(byModel['x-Mazda RX4']).toBeDefined();
		expect(byModel['Mazda RX4']).toBeUndefined(); // original FieldDef value not used
	});

	it('collectBy: a derived column name that collides with a FieldDef uses the derived value', async () => {
		const grouped = await carsQ()
			.derive({ cyl: () => 'tagged' as unknown as number })
			.collectBy('cyl');
		expect(Object.keys(grouped)).toEqual(['tagged']);
		expect(grouped['tagged']).toHaveLength(32);
	});

	it('keyBy: post-join row carries right-side fields and reads them via direct access', async () => {
		// The engine merges right-side columns into the row (right wins on
		// collision). keyBy should read those merged values, not the
		// original-entity-shape FieldDef.
		const meta = new Query<{ orderId: string; tag: string }>(
			async () => [
				{ orderId: '101', tag: 'tier-A' },
				{ orderId: '102', tag: 'tier-B' },
				{ orderId: '103', tag: 'tier-A' },
				{ orderId: '104', tag: 'tier-C' },
			],
			[
				{
					key: 'orderId',
					label: 'Order',
					type: 'string',
					group: 'data',
					getValue: (r) => r.orderId,
				},
				{ key: 'tag', label: 'Tag', type: 'string', group: 'data', getValue: (r) => r.tag },
			],
		);
		const joined = await ordersQ().join(meta, 'orderId', 'orderId').keyBy('tag');
		expect(joined['tier-A']).toBeDefined();
		expect(joined['tier-C']).toBeDefined();
	});
});

describe('Query — filter after summarize (SQL HAVING)', () => {
	it('filters on an aggregator output column', async () => {
		const big = await carsQ().summarize({ by: 'cyl', count: 'n' }).filter('n', '>', 10).toArray();
		expect(big.every((r) => (r.n as number) > 10)).toBe(true);
	});

	it('filters on a groupBy column post-summarize', async () => {
		const rows = await carsQ()
			.summarize({ by: 'cyl', count: 'n' })
			.filter('cyl', '==', 4)
			.toArray();
		expect(rows).toHaveLength(1);
		expect(rows[0].cyl).toBe('4');
	});
});
