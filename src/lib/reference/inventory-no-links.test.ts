import { describe, it, expect } from 'vitest';
import { buildInventoryTabletsWithoutLinksRows } from './inventory-no-links.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';

// Minimal fixture — only the fields the builder reads.
function tab(
	id: string,
	brand: string,
	name: string,
	type: string,
	year: string,
	links?: unknown[],
): Tablet {
	return {
		Meta: {
			EntityId: `${brand.toLowerCase()}.tablet.${id.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
		},
		Model: { Brand: brand, Id: id, Name: name, Type: type, ReleaseYear: year, Links: links },
	} as unknown as Tablet;
}
const inv = (entityId: string) => ({ TabletEntityId: entityId });

describe('buildInventoryTabletsWithoutLinksRows', () => {
	const owned = tab('PTK-670', 'WACOM', 'Intuos Pro Medium', 'PENTABLET', '2025');
	const ownedWithLinks = tab('DTH-271', 'WACOM', 'Cintiq Pro 27', 'PENDISPLAY', '2022', [
		{ Type: 'REVIEW', URL: 'https://x' },
	]);
	const notOwned = tab('CTL-4100', 'WACOM', 'Intuos Small', 'PENTABLET', '2018');

	it('includes only in-inventory tablets that have no links', () => {
		const rows = buildInventoryTabletsWithoutLinksRows(
			[owned, ownedWithLinks, notOwned],
			[inv('wacom.tablet.ptk670'), inv('wacom.tablet.dth271')],
		);
		// owned → yes; ownedWithLinks → excluded (has links); notOwned → excluded (no unit)
		expect(rows.map((r) => r.tabletEntityId)).toEqual(['wacom.tablet.ptk670']);
	});

	it('counts inventory units per tablet and maps type/year', () => {
		const [row] = buildInventoryTabletsWithoutLinksRows(
			[owned],
			[inv('wacom.tablet.ptk670'), inv('wacom.tablet.ptk670')],
		);
		expect(row.units).toBe(2);
		expect(row.type).toBe('PENTABLET');
		expect(row.year).toBe('2025');
		expect(row.brand).toBe('WACOM');
	});

	it('treats a missing Links array the same as an empty one', () => {
		const emptyArr = tab('A', 'WACOM', 'A', 'PENTABLET', '2020', []);
		const noProp = tab('B', 'WACOM', 'B', 'PENTABLET', '2020');
		const rows = buildInventoryTabletsWithoutLinksRows(
			[emptyArr, noProp],
			[inv('wacom.tablet.a'), inv('wacom.tablet.b')],
		);
		expect(rows).toHaveLength(2);
	});
});
