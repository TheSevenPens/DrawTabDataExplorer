// Plan-rewrite pass. Runs over a Step[] array between join/concat
// resolution and `executePipeline()`. Each rewrite is a pure
// `Step[] => Step[]` transformation; the entire pass is opt-out via
// `rewriteConfig.enabled = false` for debugging.
//
// Scope is deliberately minimal — Catalyst-lite. The architectural slot
// is more valuable than the specific rewrites at today's data sizes.
// See issue #140 for the design rationale and out-of-scope items.

import type {
	Step,
	FilterStep,
	BoolFilterStep,
	SortStep,
	TakeStep,
	SkipStep,
	TopKStep,
	FilterExpr,
} from './types.js';

/**
 * Global toggle. Tests flip this off to run the full suite against the
 * naive engine path; consumers can flip it off to isolate a suspected
 * rewrite bug. Defaults to enabled.
 */
export const rewriteConfig = { enabled: true };

/**
 * Run all registered rewrites over a step list. Single-pass —
 * the rewrites in this catalogue don't re-trigger each other, so
 * iterating to a fixed point isn't necessary.
 */
export function rewrite(steps: Step[]): Step[] {
	if (!rewriteConfig.enabled) return steps;
	let current = steps;
	for (const pass of REWRITES) current = pass(current);
	return current;
}

const REWRITES: Array<(steps: Step[]) => Step[]> = [
	dropTrivialSteps,
	combineTakeAndSkip,
	consolidateFilters,
	fuseSortTake,
];

// --- 1. Drop trivial steps --------------------------------------------------
//
//   reverse().reverse()                 → (drop both)
//   sort(f, d).sort(f, d) on same key   → drop the first (second supersedes)
//   skip(0)                              → (drop)

function dropTrivialSteps(steps: Step[]): Step[] {
	const out: Step[] = [];
	for (const step of steps) {
		// skip(0) is a no-op.
		if (step.kind === 'skip' && step.count === 0) continue;

		// reverse pairs.
		const last = out[out.length - 1];
		if (last?.kind === 'reverse' && step.kind === 'reverse') {
			out.pop();
			continue;
		}

		// sort followed by sort on the same field+direction: the first does
		// the work, the second is a stable no-op — drop the first per #140
		// (either drop is correct since both produce identical orderings).
		if (
			last?.kind === 'sort' &&
			step.kind === 'sort' &&
			last.field === step.field &&
			last.direction === step.direction
		) {
			out.pop();
		}

		out.push(step);
	}
	return out;
}

// --- 2. Combine consecutive take / skip arithmetic --------------------------
//
//   take(a).take(b)   → take(min(a, b))
//   skip(a).skip(b)   → skip(a + b)

function combineTakeAndSkip(steps: Step[]): Step[] {
	const out: Step[] = [];
	for (const step of steps) {
		const last = out[out.length - 1];
		if (last?.kind === 'take' && step.kind === 'take') {
			(last as TakeStep).count = Math.min(last.count, step.count);
			continue;
		}
		if (last?.kind === 'skip' && step.kind === 'skip') {
			(last as SkipStep).count = last.count + step.count;
			continue;
		}
		out.push(step);
	}
	return out;
}

// --- 3. Consolidate adjacent filter steps -----------------------------------
//
// Adjacent `filter(field, op, value)` steps each allocate a fresh array;
// fusing them into one `boolFilter` with an AND tree visits each row
// exactly once across the chain. Mixed-kind chains (predicate, boolFilter)
// are left alone — predicate is user code with unknown cost, and
// boolFilter already represents a tree.

function consolidateFilters(steps: Step[]): Step[] {
	const out: Step[] = [];
	let run: FilterStep[] = [];

	const flush = (): void => {
		if (run.length === 0) return;
		if (run.length === 1) {
			out.push(run[0]);
		} else {
			const expr: FilterExpr = {
				and: run.map((f) => ({ field: f.field, op: f.operator, value: f.value })),
			};
			const merged: BoolFilterStep = { kind: 'boolFilter', expr };
			out.push(merged);
		}
		run = [];
	};

	for (const step of steps) {
		if (step.kind === 'filter') {
			run.push(step);
		} else {
			flush();
			out.push(step);
		}
	}
	flush();
	return out;
}

// --- 4. Fuse sort + take into a single top-K step ---------------------------
//
//   sort(field, dir).take(count) → topK(field, dir, count)
//
// Only when the two are immediately adjacent. The engine implements topK
// as a stable bounded priority queue; the rewritten plan reads each row
// once instead of fully sorting.

function fuseSortTake(steps: Step[]): Step[] {
	const out: Step[] = [];
	for (let i = 0; i < steps.length; i++) {
		const a = steps[i];
		const b = steps[i + 1];
		if (a?.kind === 'sort' && b?.kind === 'take') {
			const sort = a as SortStep;
			const take = b as TakeStep;
			const topK: TopKStep = {
				kind: 'topK',
				field: sort.field,
				direction: sort.direction,
				count: take.count,
			};
			out.push(topK);
			i++; // skip the consumed take
			continue;
		}
		out.push(a);
	}
	return out;
}
