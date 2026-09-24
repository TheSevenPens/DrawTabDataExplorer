import { describe, expect, it } from 'vitest';
import {
	LEGACY_PEN_FAMILY_IDS,
	migrateFilterValue,
	migrateFilterValues,
} from './filter-value-migrations.js';

describe('migrateFilterValue — Brand', () => {
	it('rewrites a display label to its code', () => {
		expect(migrateFilterValue('Brand', '==', 'Wacom')).toBe('WACOM');
		expect(migrateFilterValue('Brand', '==', 'XP-Pen')).toBe('XPPEN');
	});

	it('matches labels case-insensitively (old casings still migrate)', () => {
		expect(migrateFilterValue('Brand', '==', 'Digidraw')).toBe('DIGIDRAW');
	});

	it('leaves codes and unknown values alone', () => {
		expect(migrateFilterValue('Brand', '==', 'WACOM')).toBe('WACOM');
		expect(migrateFilterValue('Brand', '==', 'Acme')).toBe('Acme');
	});

	it('does not touch partial text typed for contains', () => {
		expect(migrateFilterValue('Brand', 'contains', 'Wac')).toBe('Wac');
	});

	it('migrates each item of an in / notin list', () => {
		expect(migrateFilterValue('Brand', 'in', 'Wacom|XPPEN|Huion')).toBe('WACOM|XPPEN|HUION');
		expect(migrateFilterValue('Brand', 'notin', 'Wacom')).toBe('WACOM');
	});
});

describe('migrateFilterValue — PenFamily', () => {
	it('rewrites a pre-#332 family name to its EntityId', () => {
		expect(migrateFilterValue('PenFamily', '==', 'Wacom KP GEN2 pen series')).toBe(
			'wacom.penfamily.wacom_kpgen2',
		);
	});

	it('leaves EntityIds alone', () => {
		expect(migrateFilterValue('PenFamily', '==', 'wacom.penfamily.wacom_kpgen2')).toBe(
			'wacom.penfamily.wacom_kpgen2',
		);
	});
});

describe('migrateFilterValue — other fields', () => {
	it('is a no-op for fields with no migration', () => {
		expect(migrateFilterValue('PenName', '==', 'Wacom')).toBe('Wacom');
	});
});

describe('migrateFilterValues', () => {
	it('migrates filter steps and nested boolean conditions, leaving the rest', () => {
		const view = {
			name: 'Wacom KP',
			steps: [
				{ kind: 'filter', field: 'Brand', operator: '==', value: 'Wacom' },
				{
					kind: 'boolFilter',
					expr: {
						or: [
							{ field: 'PenFamily', op: '==', value: 'Wacom KP GEN1 pen series' },
							{ field: 'PenName', op: 'contains', value: 'Wacom' },
						],
					},
				},
				{ kind: 'sort', field: 'Brand', direction: 'asc' },
			],
		};
		expect(migrateFilterValues(view)).toEqual({
			name: 'Wacom KP',
			steps: [
				{ kind: 'filter', field: 'Brand', operator: '==', value: 'WACOM' },
				{
					kind: 'boolFilter',
					expr: {
						or: [
							{ field: 'PenFamily', op: '==', value: 'wacom.penfamily.wacom_kpgen1' },
							{ field: 'PenName', op: 'contains', value: 'Wacom' },
						],
					},
				},
				{ kind: 'sort', field: 'Brand', direction: 'asc' },
			],
		});
	});

	it('does not mutate its input', () => {
		const step = { kind: 'filter', field: 'Brand', operator: '==', value: 'Wacom' };
		migrateFilterValues([step]);
		expect(step.value).toBe('Wacom');
	});
});

describe('LEGACY_PEN_FAMILY_IDS', () => {
	it('maps to lowercase pen-family EntityIds', () => {
		for (const id of Object.values(LEGACY_PEN_FAMILY_IDS)) {
			expect(id).toMatch(/^[a-z]+\.penfamily\.[a-z0-9_]+$/);
		}
	});
});
