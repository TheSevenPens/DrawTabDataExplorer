import { describe, it, expect } from 'vitest';
import { buildTabletLinkRows } from './tablet-links.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';

// Minimal fixture — only the fields buildTabletLinkRows reads.
function tab(id: string, brand: string, name: string, links?: unknown[]): Tablet {
	return {
		Meta: {
			EntityId: `${brand.toLowerCase()}.tablet.${id.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
		},
		Model: { Brand: brand, Id: id, Name: name, Links: links },
	} as unknown as Tablet;
}

const REVIEW = (url: string, extra = {}) => ({ Type: 'REVIEW', URL: url, ...extra });

describe('buildTabletLinkRows', () => {
	it('emits one row per link and skips tablets with no links', () => {
		const rows = buildTabletLinkRows([
			tab('PTK-670', 'WACOM', 'Intuos Pro Medium', [
				REVIEW('https://a', { Title: 'A', Author: 'Alice', PublishDate: '2025-01-01' }),
				{ Type: 'PRODUCTINFO', URL: 'https://b' },
			]),
			tab('CTL-4100', 'WACOM', 'Intuos Small'), // no Links → contributes nothing
		]);
		expect(rows).toHaveLength(2);
	});

	it('maps every field, defaulting optional link fields to empty strings', () => {
		const [row] = buildTabletLinkRows([
			tab('PTK-670', 'WACOM', 'Intuos Pro Medium', [
				REVIEW('https://a', { Title: 'A', Author: 'Alice', PublishDate: '2025-01-01' }),
			]),
		]);
		expect(row.tabletEntityId).toBe('wacom.tablet.ptk670');
		expect(row.brand).toBe('WACOM');
		expect(row.type).toBe('REVIEW');
		expect(row.url).toBe('https://a');
		expect(row.title).toBe('A');
		expect(row.author).toBe('Alice');
		expect(row.publishDate).toBe('2025-01-01');

		const [bare] = buildTabletLinkRows([
			tab('X', 'WACOM', 'X', [{ Type: 'STORE', URL: 'https://s' }]),
		]);
		expect(bare.title).toBe('');
		expect(bare.author).toBe('');
		expect(bare.publishDate).toBe('');
	});

	it('sorts by tablet name, then by type rank (REVIEW before STORE)', () => {
		const rows = buildTabletLinkRows([
			tab('Z', 'WACOM', 'Zeta', [{ Type: 'STORE', URL: 'https://z-store' }]),
			tab('A', 'WACOM', 'Alpha', [
				{ Type: 'STORE', URL: 'https://a-store' },
				REVIEW('https://a-review'),
			]),
		]);
		// Alpha sorts before Zeta; within Alpha, REVIEW (rank 0) before STORE (rank 3).
		expect(rows.map((r) => r.url)).toEqual([
			'https://a-review',
			'https://a-store',
			'https://z-store',
		]);
	});
});
