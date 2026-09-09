import { describe, it, expect } from 'vitest';
import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
import { cellText } from './cell-text.js';

type Row = { Brand: string; EntityId: string; Name: string; Diagonal: string };

const row: Row = {
	Brand: 'XPPEN',
	EntityId: 'wacom.tablet.dth271',
	Name: 'Cintiq Pro 27',
	Diagonal: '338',
};

const plain: AnyFieldDisplayDef = {
	key: 'Name',
	label: 'Name',
	getValue: (r: Row) => r.Name,
	type: 'string',
	group: 'Model',
};

// Stores the enum, draws the marketing spelling — the /tablets Brand column.
const branded: AnyFieldDisplayDef = {
	key: 'Brand',
	label: 'Brand',
	getValue: (r: Row) => r.Brand,
	getDisplayValue: () => 'XP-Pen',
	type: 'enum',
	group: 'Model',
};

const measured: AnyFieldDisplayDef = {
	key: 'Diagonal',
	label: 'Diagonal',
	getValue: (r: Row) => r.Diagonal,
	unit: 'mm',
	type: 'number',
	group: 'Model',
};

// The inventory pages' Tablet column: the field is the EntityId, the cell
// draws the model's name.
const linked: AnyFieldDisplayDef = {
	key: 'EntityId',
	label: 'Tablet',
	getValue: (r: Row) => r.EntityId,
	type: 'string',
	group: 'Tablet',
};
const cellLinks = {
	EntityId: (r: Row) => [{ label: r.Name, href: '/entity/' + r.EntityId }],
};

describe('cellText', () => {
	it('falls back to the stored value when nothing rewrites it', () => {
		expect(cellText(row, plain, { unitPreference: 'metric' })).toBe('Cintiq Pro 27');
	});

	it('prefers getDisplayValue over the stored value', () => {
		expect(cellText(row, branded, { unitPreference: 'metric' })).toBe('XP-Pen');
	});

	it('prefers a cell link label over everything else', () => {
		expect(cellText(row, linked, { cellLinks, unitPreference: 'metric' })).toBe('Cintiq Pro 27');
	});

	it('joins multiple link labels the way the table draws them', () => {
		const many = {
			EntityId: () => [
				{ label: 'A', href: '#' },
				{ label: 'B', href: '#' },
			],
		};
		expect(cellText(row, linked, { cellLinks: many, unitPreference: 'metric' })).toBe('A, B');
	});

	it('renders an empty link list as empty text, not the stored value', () => {
		const none = { EntityId: () => [] };
		expect(cellText(row, linked, { cellLinks: none, unitPreference: 'metric' })).toBe('');
	});

	it('applies the viewer unit preference', () => {
		expect(cellText(row, measured, { unitPreference: 'metric' })).toBe('338');
		expect(cellText(row, measured, { unitPreference: 'imperial' })).not.toBe('338');
	});

	it('ignores cellLinks for a field that has none', () => {
		expect(cellText(row, plain, { cellLinks, unitPreference: 'metric' })).toBe('Cintiq Pro 27');
	});
});
