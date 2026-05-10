import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadViews, saveView, deleteView, renameView } from './views.js';
import type { Step, SelectStep, SortStep } from '$data/lib/pipeline/types.js';

const ENTITY = 'tablets';
const KEY = `drawtabdata-views-${ENTITY}`;
const LEGACY_KEY = 'drawtabdata-views';

// Tiny factory so the test cases stay readable. The minimum-shape Step
// for each kind is unique enough that a discriminated factory is the
// most straightforward thing here — only `select` and `sort` are used
// in this file.
function STEP(kind: 'select'): SelectStep;
function STEP(kind: 'sort'): SortStep;
function STEP(kind: 'select' | 'sort'): Step {
	if (kind === 'select') return { kind: 'select', fields: [] };
	return { kind: 'sort', field: '', direction: 'asc' };
}

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	localStorage.clear();
});

describe('loadViews', () => {
	it('returns empty array when no views are stored', () => {
		expect(loadViews(ENTITY)).toEqual([]);
	});

	it('returns stored views', () => {
		localStorage.setItem(KEY, JSON.stringify([{ name: 'a', steps: [] }]));
		expect(loadViews(ENTITY)).toEqual([{ name: 'a', steps: [] }]);
	});

	it('filters out malformed entries (missing name / non-array steps)', () => {
		localStorage.setItem(
			KEY,
			JSON.stringify([
				{ name: 'good', steps: [] },
				{ name: 123, steps: [] }, // bad name
				{ name: 'no-steps' }, // missing steps
				{ steps: [] }, // missing name
				null,
				'not-an-object',
			]),
		);
		expect(loadViews(ENTITY)).toEqual([{ name: 'good', steps: [] }]);
	});

	it('returns empty array when stored value is not an array', () => {
		localStorage.setItem(KEY, JSON.stringify({ not: 'an array' }));
		expect(loadViews(ENTITY)).toEqual([]);
	});
});

describe('saveView', () => {
	it('appends a new view', () => {
		saveView(ENTITY, 'a', [STEP('select')]);
		expect(loadViews(ENTITY)).toEqual([{ name: 'a', steps: [{ kind: 'select', fields: [] }] }]);
	});

	it('overwrites an existing view with the same name', () => {
		saveView(ENTITY, 'a', [STEP('select')]);
		saveView(ENTITY, 'a', [STEP('sort')]);
		const views = loadViews(ENTITY);
		expect(views).toHaveLength(1);
		expect(views[0].steps[0].kind).toBe('sort');
	});

	it('deep-clones steps so later mutation of the source does not leak in', () => {
		const steps = [STEP('select')];
		saveView(ENTITY, 'a', steps);
		(steps[0] as { kind: string }).kind = 'mutated';
		expect(loadViews(ENTITY)[0].steps[0].kind).toBe('select');
	});
});

describe('deleteView', () => {
	it('removes the named view', () => {
		saveView(ENTITY, 'a', []);
		saveView(ENTITY, 'b', []);
		deleteView(ENTITY, 'a');
		expect(loadViews(ENTITY).map((v) => v.name)).toEqual(['b']);
	});

	it('is a no-op when the name does not exist', () => {
		saveView(ENTITY, 'a', []);
		deleteView(ENTITY, 'missing');
		expect(loadViews(ENTITY).map((v) => v.name)).toEqual(['a']);
	});
});

describe('renameView', () => {
	it('renames the matching view', () => {
		saveView(ENTITY, 'a', []);
		renameView(ENTITY, 'a', 'b');
		expect(loadViews(ENTITY).map((v) => v.name)).toEqual(['b']);
	});

	it('is a no-op when the old name does not exist', () => {
		saveView(ENTITY, 'a', []);
		renameView(ENTITY, 'missing', 'new');
		expect(loadViews(ENTITY).map((v) => v.name)).toEqual(['a']);
	});
});

describe('migration from legacy key', () => {
	it('moves data from drawtabdata-views to the entity-scoped key', () => {
		localStorage.setItem(LEGACY_KEY, JSON.stringify([{ name: 'legacy', steps: [] }]));
		const views = loadViews(ENTITY);
		expect(views).toEqual([{ name: 'legacy', steps: [] }]);
		expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
		expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual([
			{ name: 'legacy', steps: [] },
		]);
	});

	it('does nothing when the legacy key is empty', () => {
		expect(loadViews(ENTITY)).toEqual([]);
		expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
	});
});
