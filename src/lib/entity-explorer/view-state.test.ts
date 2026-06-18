import { describe, it, expect } from 'vitest';
import { buildActiveSteps, type FilterItem } from './view-state.js';

describe('buildActiveSteps', () => {
	it('builds filter → sort → select in order', () => {
		const steps = buildActiveSteps(
			[{ field: 'Brand', operator: '==', value: 'WACOM' }],
			[{ field: 'Year', direction: 'desc' }],
			['Brand', 'Year'],
		);
		expect(steps).toEqual([
			{ kind: 'filter', field: 'Brand', operator: '==', value: 'WACOM' },
			{ kind: 'sort', field: 'Year', direction: 'desc' },
			{ kind: 'select', fields: ['Brand', 'Year'] },
		]);
	});

	// GitHub #227: saved views capture the active query only — disabled filters
	// are transient UI state and must NOT be persisted/executed.
	it('omits disabled filters', () => {
		const filters: FilterItem[] = [
			{ field: 'Brand', operator: '==', value: 'WACOM' },
			{ field: 'Type', operator: '==', value: 'PENTABLET', disabled: true },
		];
		const steps = buildActiveSteps(filters, [], ['Brand']);
		const filterSteps = steps.filter((s) => s.kind === 'filter');
		expect(filterSteps).toEqual([
			{ kind: 'filter', field: 'Brand', operator: '==', value: 'WACOM' },
		]);
	});

	it('omits value-needing filters with an empty value, but keeps empty/notempty', () => {
		const filters: FilterItem[] = [
			{ field: 'A', operator: '==', value: '' }, // dropped — needs a value
			{ field: 'B', operator: 'empty', value: '' }, // kept — no value needed
			{ field: 'C', operator: 'notempty', value: '' }, // kept
		];
		const fields = buildActiveSteps(filters, [], [])
			.filter((s) => s.kind === 'filter')
			.map((s) => (s as { field: string }).field);
		expect(fields).toEqual(['B', 'C']);
	});

	it('always appends a select step even with no columns', () => {
		const steps = buildActiveSteps([], [], []);
		expect(steps).toEqual([{ kind: 'select', fields: [] }]);
	});
});
