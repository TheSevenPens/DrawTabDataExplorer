// Dedicated null-handling coverage. Pins every documented null behaviour
// from the queriton engine so future refactors can't silently regress
// any of them. Several are surprising-but-intentional — the
// **join-on-null-equals-null** semantic in particular diverges from SQL.
//
// Source-of-truth for these rules: issue #139 (Phase 5 acceptance).

import { describe, it, expect } from 'vitest';
import { Query } from '../src/index.js';
import { withNulls, withNullsFields, type NullRow } from './fixtures/with-nulls.js';
import { people, peopleFields, type Person } from './fixtures/people-hobbies.js';

function rowsQ(): Query<NullRow> {
	return new Query<NullRow>(async () => withNulls, withNullsFields);
}
function peopleQ(): Query<Person> {
	return new Query<Person>(async () => people, peopleFields);
}

// Counts of known null/empty conditions in the with-nulls fixture:
//   category null       → rows d, g                (2)
//   value null          → row c                    (1)
//   value non-numeric   → row g ('oops')           (1)
//   tag null            → rows b, g                (2)
//   tag empty string    → row e                    (1)  — treated like null
//
// Total rows: 8.

describe('Null handling — filter operators', () => {
	it("'empty' matches missing / null / empty-string values", async () => {
		// category: nulls in d, g → 2 rows.
		const cat = await rowsQ().filter('category', 'empty', '').toArray();
		expect(cat.map((r) => r.id).sort()).toEqual(['d', 'g']);

		// tag: nulls in b, g + empty-string in e → 3 rows.
		const tag = await rowsQ().filter('tag', 'empty', '').toArray();
		expect(tag.map((r) => r.id).sort()).toEqual(['b', 'e', 'g']);
	});

	it("'notempty' is the complement of 'empty'", async () => {
		const total = await rowsQ().count();
		const empty = await rowsQ().filter('tag', 'empty', '').count();
		const notEmpty = await rowsQ().filter('tag', 'notempty', '').count();
		expect(empty + notEmpty).toBe(total);
	});

	it("'==' with refValue '' matches null/missing fields", async () => {
		// Null/missing tag fields stringify to "" → match.
		const rows = await rowsQ().filter('tag', '==', '').toArray();
		expect(rows.map((r) => r.id).sort()).toEqual(['b', 'e', 'g']);
	});

	it("'contains' with empty refValue matches every row (JS '' includes '' === true)", async () => {
		// Surprising but standard JS string semantics. Pinned here so a future
		// "filter out empties" optimisation can't silently flip it.
		const all = await rowsQ().filter('tag', 'contains', '').count();
		expect(all).toBe(await rowsQ().count());
	});

	it("'contains' / 'startswith' on a null value with a non-empty refValue → no match", async () => {
		// b has tag=null, g has tag=null. Neither should match 'red'.
		const rows = await rowsQ().filter('tag', 'contains', 'red').toArray();
		expect(rows.every((r) => r.tag === 'red')).toBe(true);
		expect(rows.map((r) => r.id).sort()).toEqual(['a', 'd', 'h']);
	});

	it("numeric '>', '>=', '<', '<=' exclude null values", async () => {
		// row c has value=null, row g has value='oops' (non-numeric).
		// Both excluded from any numeric comparison.
		const positives = await rowsQ().filter('value', '>', -1).toArray();
		expect(positives.map((r) => r.id).sort()).toEqual(['a', 'b', 'd', 'e', 'f', 'h']);
		// Pin: every other row (c, g) is excluded.
		expect(positives.find((r) => r.id === 'c')).toBeUndefined();
		expect(positives.find((r) => r.id === 'g')).toBeUndefined();
	});

	it("'between' excludes nulls (same numeric-op rule)", async () => {
		const rows = await rowsQ().filter('value', 'between', '0|100').toArray();
		expect(rows.find((r) => r.id === 'c')).toBeUndefined();
		expect(rows.find((r) => r.id === 'g')).toBeUndefined();
	});
});

describe('Null handling — sort', () => {
	it('asc: null values surface first ("" is the smallest string in localeCompare)', async () => {
		const rows = await rowsQ().sort('tag', 'asc').toArray();
		// Null/empty tags come first.
		expect(rows[0].tag === null || rows[0].tag === '').toBe(true);
		expect(rows[1].tag === null || rows[1].tag === '').toBe(true);
		expect(rows[2].tag === null || rows[2].tag === '').toBe(true);
	});

	it('desc: null values surface last', async () => {
		const rows = await rowsQ().sort('tag', 'desc').toArray();
		const tail = rows.slice(-3);
		for (const r of tail) {
			expect(r.tag === null || r.tag === '').toBe(true);
		}
	});
});

describe('Null handling — summarize aggregators', () => {
	it('count includes null rows', async () => {
		// Group by category — null categories collapse to a single key ("").
		const rows = await rowsQ().summarize({ by: 'category', count: 'n' }).toArray();
		const total = rows.reduce((s, r) => s + (r.n as number), 0);
		expect(total).toBe(await rowsQ().count()); // no rows dropped
	});

	it('sum / avg / min / max / median skip null and non-numeric values', async () => {
		// Numeric values present: 10, 20, 30, 0, 40, 50 (6 rows).
		// Skipped: null (c), non-numeric "oops" (g).
		const rows = await rowsQ()
			.summarize({
				count: 'n',
				sum: { s: 'value' },
				avg: { a: 'value' },
				min: { lo: 'value' },
				max: { hi: 'value' },
				median: { mid: 'value' },
			})
			.toArray();
		const r = rows[0];
		// count counts every row (including the skipped ones).
		expect(r.n).toBe(8);
		// sum/avg/min/max/median are over the 6 numeric values only.
		expect(r.s).toBe(10 + 20 + 30 + 0 + 40 + 50);
		expect(r.a).toBeCloseTo((10 + 20 + 30 + 0 + 40 + 50) / 6, 4);
		expect(r.lo).toBe(0);
		expect(r.hi).toBe(50);
	});

	it('distinctCount skips null values', async () => {
		const rows = await rowsQ()
			.summarize({ distinctCount: { dc: 'category' } })
			.toArray();
		// Categories present: X, Y, Z (3 distinct). Nulls excluded.
		expect(rows[0].dc).toBe(3);
	});

	it('first / last / collect INCLUDE nulls as raw "" entries', async () => {
		const rows = await rowsQ()
			.summarize({
				first: { f: 'tag' },
				last: { l: 'tag' },
				collect: { c: 'tag' },
			})
			.toArray();
		// First row's tag is 'red' (a); last row's is 'red' (h).
		expect(rows[0].f).toBe('red');
		expect(rows[0].l).toBe('red');
		// collect contains 8 entries — null/empty are represented as "".
		const col = rows[0].c as string[];
		expect(col).toHaveLength(8);
		expect(col).toContain(''); // null/missing/empty tags collected as ""
	});

	it('groupBy with a null-valued key bundles those rows into one "" bucket', async () => {
		const rows = await rowsQ().summarize({ by: 'category', count: 'n' }).toArray();
		const nullBucket = rows.find((r) => r.category === '');
		expect(nullBucket).toBeDefined();
		// Rows d, g have null category → 2 rows in the bucket.
		expect(nullBucket!.n).toBe(2);
	});
});

describe('Null handling — terminal verbs', () => {
	it('.distinct() excludes empty / null values', async () => {
		// category: X, Y, Z, X, Y, Z, null, X → distinct non-empty = [X, Y, Z].
		const cats = await rowsQ().distinct('category');
		expect(cats).toEqual(['X', 'Y', 'Z']);
	});

	it('.keyBy() skips rows with a null/empty key (no entry created)', async () => {
		const byCat = await rowsQ().keyBy('category');
		expect(Object.keys(byCat).sort()).toEqual(['X', 'Y', 'Z']);
		// Rows d and g (null category) are dropped from the output.
		expect(byCat[''] as unknown).toBeUndefined();
	});

	it('.collectBy() skips rows with a null/empty key', async () => {
		const byCat = await rowsQ().collectBy('category');
		expect(Object.keys(byCat).sort()).toEqual(['X', 'Y', 'Z']);
		// No '' bucket created.
		expect(byCat[''] as unknown).toBeUndefined();
	});
});

describe('Null handling — joins (SQL-divergent semantic)', () => {
	// All four joins index right rows by getValue(). Null/missing keys
	// stringify to "". Two rows with "" on both sides therefore JOIN
	// TOGETHER — the opposite of SQL's NULL != NULL.
	//
	// This is a deliberate design choice, not an accident. Pinning here
	// so a future SQL-semantics refactor surfaces as a test failure
	// rather than a silent behavioural drift.

	const leftRows: NullRow[] = [
		{ id: 'L1', category: 'X', value: 1, tag: null },
		{ id: 'L2', category: null, value: 2, tag: null },
	];
	const rightRows: NullRow[] = [
		{ id: 'R1', category: 'X', value: 99, tag: null },
		{ id: 'R2', category: null, value: 88, tag: null },
	];

	function leftQ(): Query<NullRow> {
		return new Query<NullRow>(async () => leftRows, withNullsFields);
	}
	function rightQ(): Query<NullRow> {
		return new Query<NullRow>(async () => rightRows, withNullsFields);
	}

	it('inner join: null key on both sides matches (DIFFERS from SQL)', async () => {
		const rows = await leftQ().join(rightQ(), 'category', 'category').toArray();
		// L1 (X) matches R1 (X); L2 (null/"") matches R2 (null/"") because both
		// keys stringify to "" → the engine treats them as equal.
		expect(rows).toHaveLength(2);
	});

	it('semijoin: keeps left rows whose null key has a null-keyed right row', async () => {
		const rows = await leftQ().semijoin(rightQ(), 'category', 'category').toArray();
		expect(rows.map((r) => r.id).sort()).toEqual(['L1', 'L2']);
	});

	it('antijoin: a left row with a null key is NOT considered orphaned if a null-keyed right row exists', async () => {
		const rows = await leftQ().antijoin(rightQ(), 'category', 'category').toArray();
		expect(rows).toHaveLength(0);
	});

	it('leftjoin: null-keyed left row merges with null-keyed right row', async () => {
		const rows = await leftQ().leftjoin(rightQ(), 'category', 'category').toArray();
		expect(rows).toHaveLength(2);
		// Both rows pick up the right-side `value` column.
		expect(rows.every((r) => typeof (r as Record<string, unknown>).value === 'number')).toBe(true);
	});
});

describe('Null handling — unroll', () => {
	it('field is null / not an array → row passes through unchanged', async () => {
		// Eve has hobbies=null; the engine treats non-arrays as passthrough.
		const rows = await peopleQ()
			.derive({ hobby: (p) => p.hobbies as unknown as string })
			.unroll('hobby')
			.toArray();
		const eveRows = rows.filter((r) => (r as Record<string, unknown>).name === 'Eve');
		expect(eveRows).toHaveLength(1);
	});

	it('field is [] → row is dropped', async () => {
		// Charlie has hobbies=[].
		const rows = await peopleQ()
			.derive({ hobby: (p) => p.hobbies as unknown as string })
			.unroll('hobby')
			.toArray();
		const charlieRows = rows.filter((r) => (r as Record<string, unknown>).name === 'Charlie');
		expect(charlieRows).toHaveLength(0);
	});

	it('field contains a null element → null survives as its own row', async () => {
		// Synthetic case: hand-build a fixture row with an array containing null.
		const rows: Array<{ name: string; tags: (string | null)[] }> = [
			{ name: 'X', tags: ['a', null, 'c'] },
		];
		const fields = peopleFields; // shape-compatible
		const q = new Query<{ name: string; tags: (string | null)[] }>(async () => rows, fields);
		const out = await q
			.derive({ tag: (r) => r.tags as unknown as string })
			.unroll('tag')
			.toArray();
		expect(out).toHaveLength(3);
		// One row has tag === null (engine treats null elements like any other).
		const nullTag = out.filter((r) => (r as Record<string, unknown>).tag === null);
		expect(nullTag).toHaveLength(1);
	});
});
