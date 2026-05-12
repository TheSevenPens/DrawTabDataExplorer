// Tests for the plan-rewrite pass.
//
// Two kinds of coverage:
//
// 1. Per-rewrite: each rewrite has a test that runs `rewrite(steps)` on a
//    hand-built `Step[]` and asserts the expected post-rewrite shape. These
//    pin the rewrite logic itself.
//
// 2. Equivalence: a meta-test runs a few representative Query chains
//    both with rewrites enabled and disabled, and asserts the results are
//    identical. This catches "rewrite changes observable behaviour"
//    mistakes immediately.

import { describe, it, expect, afterEach } from 'vitest';
import { Query, rewrite, rewriteConfig, type Step } from '../src/index.js';
import { mtcars, mtcarsFields, type Car } from './fixtures/mtcars.js';

function carsQ(): Query<Car> {
	return new Query<Car>(async () => mtcars, mtcarsFields);
}

// --- Per-rewrite shape tests -----------------------------------------------

describe('rewrite — drop trivial steps', () => {
	it('drops skip(0)', () => {
		const out = rewrite([
			{ kind: 'skip', count: 0 },
			{ kind: 'take', count: 5 },
		]);
		expect(out).toEqual([{ kind: 'take', count: 5 }]);
	});

	it('collapses reverse().reverse()', () => {
		const out = rewrite([{ kind: 'reverse' }, { kind: 'reverse' }]);
		expect(out).toEqual([]);
	});

	it('collapses three consecutive reverses to one', () => {
		// reverse-reverse pairs off, leaving a single reverse.
		const out = rewrite([{ kind: 'reverse' }, { kind: 'reverse' }, { kind: 'reverse' }]);
		expect(out).toEqual([{ kind: 'reverse' }]);
	});

	it('drops the first of two identical adjacent sorts', () => {
		const out = rewrite([
			{ kind: 'sort', field: 'mpg', direction: 'asc' },
			{ kind: 'sort', field: 'mpg', direction: 'asc' },
		]);
		// The remaining sort gets fused into topK if followed by take —
		// but with no take after it, it stays a plain sort.
		expect(out).toEqual([{ kind: 'sort', field: 'mpg', direction: 'asc' }]);
	});

	it('keeps two sorts on different fields (multi-key sort idiom)', () => {
		const out = rewrite([
			{ kind: 'sort', field: 'cyl', direction: 'asc' },
			{ kind: 'sort', field: 'mpg', direction: 'desc' },
		]);
		expect(out).toHaveLength(2);
	});
});

describe('rewrite — combine take / skip arithmetic', () => {
	it('take(a).take(b) → take(min(a, b))', () => {
		expect(
			rewrite([
				{ kind: 'take', count: 5 },
				{ kind: 'take', count: 3 },
			]),
		).toEqual([{ kind: 'take', count: 3 }]);
		expect(
			rewrite([
				{ kind: 'take', count: 3 },
				{ kind: 'take', count: 5 },
			]),
		).toEqual([{ kind: 'take', count: 3 }]);
	});

	it('skip(a).skip(b) → skip(a + b)', () => {
		expect(
			rewrite([
				{ kind: 'skip', count: 4 },
				{ kind: 'skip', count: 6 },
			]),
		).toEqual([{ kind: 'skip', count: 10 }]);
	});

	it('does not combine take with skip', () => {
		const out = rewrite([
			{ kind: 'take', count: 10 },
			{ kind: 'skip', count: 3 },
		]);
		expect(out).toHaveLength(2);
	});
});

describe('rewrite — consolidate adjacent filter steps', () => {
	it('fuses two adjacent filter steps into one boolFilter (AND)', () => {
		const out = rewrite([
			{ kind: 'filter', field: 'cyl', operator: '==', value: '4' },
			{ kind: 'filter', field: 'mpg', operator: '>', value: '20' },
		]);
		expect(out).toEqual([
			{
				kind: 'boolFilter',
				expr: {
					and: [
						{ field: 'cyl', op: '==', value: '4' },
						{ field: 'mpg', op: '>', value: '20' },
					],
				},
			},
		]);
	});

	it('keeps a lone filter as-is', () => {
		const out = rewrite([{ kind: 'filter', field: 'cyl', operator: '==', value: '4' }]);
		expect(out).toEqual([{ kind: 'filter', field: 'cyl', operator: '==', value: '4' }]);
	});

	it('breaks the run on a non-filter step', () => {
		const out = rewrite([
			{ kind: 'filter', field: 'cyl', operator: '==', value: '4' },
			{ kind: 'sort', field: 'mpg', direction: 'asc' },
			{ kind: 'filter', field: 'mpg', operator: '>', value: '20' },
		]);
		// Three steps: lone filter, sort, lone filter — none consolidated.
		expect(out).toHaveLength(3);
		expect(out[0].kind).toBe('filter');
		expect(out[1].kind).toBe('sort');
		expect(out[2].kind).toBe('filter');
	});

	it('does not pull predicate or boolFilter into the run', () => {
		const out = rewrite([
			{ kind: 'filter', field: 'cyl', operator: '==', value: '4' },
			{ kind: 'predicate', fn: () => true },
			{ kind: 'filter', field: 'mpg', operator: '>', value: '20' },
		]);
		expect(out).toHaveLength(3); // each filter stays solo (predicate splits the run)
	});
});

describe('rewrite — fuse sort + take into top-K', () => {
	it('replaces sort(...).take(n) with one topK step', () => {
		const out = rewrite([
			{ kind: 'sort', field: 'mpg', direction: 'desc' },
			{ kind: 'take', count: 5 },
		]);
		expect(out).toEqual([{ kind: 'topK', field: 'mpg', direction: 'desc', count: 5 }]);
	});

	it('leaves sort alone when no take follows', () => {
		const out = rewrite([{ kind: 'sort', field: 'mpg', direction: 'desc' }]);
		expect(out).toEqual([{ kind: 'sort', field: 'mpg', direction: 'desc' }]);
	});

	it('does not fuse when a step sits between sort and take', () => {
		const out = rewrite([
			{ kind: 'sort', field: 'mpg', direction: 'desc' },
			{ kind: 'reverse' },
			{ kind: 'take', count: 5 },
		]);
		// Sort + reverse + take stay as three steps.
		expect(out).toHaveLength(3);
		expect(out[0].kind).toBe('sort');
	});
});

// --- End-to-end equivalence ------------------------------------------------

describe('rewrite — execution equivalence (with vs. without)', () => {
	// Run each Query twice — once with rewrites enabled, once disabled —
	// and assert the materialised results match. If any rewrite ever
	// silently changes behaviour, one of these will diverge.

	const cases: { name: string; build: () => Query<unknown> }[] = [
		{
			name: 'sort + take (the topK rewrite path)',
			build: () => carsQ().sort('mpg', 'desc').take(5) as Query<unknown>,
		},
		{
			name: 'sort(asc) + take with ties (stable bounded top-K)',
			build: () => carsQ().sort('cyl', 'asc').take(10) as Query<unknown>,
		},
		{
			name: 'three chained filters (consolidation)',
			build: () =>
				carsQ()
					.filter('cyl', '==', 4)
					.filter('mpg', '>', 20)
					.filter('gear', '==', 4) as Query<unknown>,
		},
		{
			name: 'take(10).take(3) (arithmetic)',
			build: () => carsQ().take(10).take(3) as Query<unknown>,
		},
		{
			name: 'skip(5).skip(3) (arithmetic)',
			build: () => carsQ().skip(5).skip(3) as Query<unknown>,
		},
		{
			name: 'reverse + reverse (cancellation)',
			build: () => carsQ().reverse().reverse() as Query<unknown>,
		},
		{
			name: 'complex chain: filter + sort + take',
			build: () =>
				carsQ()
					.filter('cyl', '==', 8)
					.filter('hp', '>', 150)
					.sort('mpg', 'desc')
					.take(3) as Query<unknown>,
		},
	];

	afterEach(() => {
		rewriteConfig.enabled = true;
	});

	for (const { name, build } of cases) {
		it(name, async () => {
			rewriteConfig.enabled = true;
			const withRewrite = await build().toArray();
			rewriteConfig.enabled = false;
			const withoutRewrite = await build().toArray();
			expect(withRewrite).toEqual(withoutRewrite);
		});
	}
});

// --- toSteps() reflects the rewritten plan ---------------------------------
//
// `toSteps()` returns the pipeline's source-of-truth Step[] (pre-rewrite).
// That's intentional — saved-view persistence wants the user's authored
// plan, not the optimised one. This test pins that contract.

describe('rewrite — toSteps() returns the pre-rewrite plan', () => {
	it('reports the chain the user wrote, not the optimiser output', () => {
		const q = carsQ().sort('mpg', 'desc').take(5);
		const steps: Step[] = q.toSteps();
		// Should be 2 user-authored steps even though the rewrite would
		// fuse them into one topK at execution time.
		expect(steps).toHaveLength(2);
		expect(steps[0].kind).toBe('sort');
		expect(steps[1].kind).toBe('take');
	});
});
