import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
import { createDiskDataSet } from '$data/lib/dataset-node.js';
import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
import type { Tablet } from '$data/lib/drawtab-loader.js';
import { cellText } from './cell-text.js';
import { applyTextSearch } from './entity-explorer/search.js';
import {
	compileSearch,
	IDENTITY_SEARCH_KEYS,
	stripForSearch,
	strippedCandidates,
} from './search-match.js';
import type { CellLinks } from './table-types.js';

const opts = { unitPreference: 'metric' as const };

describe('stripForSearch', () => {
	it('drops separators, spaces and symbols; keeps letters and numbers', () => {
		expect(stripForSearch('PTK-1240')).toBe('ptk1240');
		expect(stripForSearch('ptk 1240')).toBe('ptk1240');
		expect(stripForSearch('PTK_1240')).toBe('ptk1240');
		expect(stripForSearch('iPad-Pro-12.9 (Gen1)')).toBe('ipadpro129gen1');
	});

	it('keeps combining marks, so distinct spellings stay distinct', () => {
		expect(stripForSearch('कि')).not.toBe(stripForSearch('की'));
	});

	it('treats precomposed and decomposed forms as equal (NFC)', () => {
		expect(stripForSearch('Café')).toBe(stripForSearch('Café'));
	});

	it('does not fold accents', () => {
		expect(stripForSearch('café')).not.toBe(stripForSearch('cafe'));
	});
});

describe('compileSearch', () => {
	it('is null for a blank or whitespace-only query', () => {
		expect(compileSearch('')).toBeNull();
		expect(compileSearch('   ')).toBeNull();
	});

	it('exact check is the old case-insensitive substring', () => {
		const s = compileSearch(' Cintiq ')!;
		expect(s.exact('Wacom Cintiq Pro 27')).toBe(true);
		expect(s.exact(null)).toBe(false);
	});

	it('stripped check matches in both directions', () => {
		expect(compileSearch('PTK1240')!.stripped('PTK-1240')).toBe(true);
		expect(compileSearch('CD-120FH')!.stripped('CD120FH')).toBe(true);
	});

	it('never runs the stripped check for a query without a letter', () => {
		const s = compileSearch('13.3')!;
		expect(s.stripped('1330')).toBe(false);
		expect(s.stripped('2133')).toBe(false);
	});

	it('never runs it when the query strips to nothing', () => {
		expect(compileSearch('---')!.stripped('anything')).toBe(false);
		expect(compileSearch('_ - .')!.stripped('anything')).toBe(false);
	});
});

describe('IDENTITY_SEARCH_KEYS', () => {
	it('includes IDs, names and aliases; excludes measurements and dates', () => {
		for (const k of ['ModelId', 'PenId', 'ModelName', 'AlternateNames', 'Brand', 'FullName']) {
			expect(IDENTITY_SEARCH_KEYS.has(k)).toBe(true);
		}
		for (const k of ['DigitizerDimensions', 'ModelReleaseYear', 'ReleaseDate', 'PhysicalWeight']) {
			expect(IDENTITY_SEARCH_KEYS.has(k)).toBe(false);
		}
	});
});

describe('strippedCandidates keeps values separate', () => {
	const altNames = TABLET_FIELDS.find((f) => f.key === 'AlternateNames') as AnyFieldDisplayDef;

	it('lists each alternate name on its own', () => {
		const row = { Model: { AlternateNames: ['Foo Bar', 'Baz'] } };
		expect(strippedCandidates(row, altNames, opts)).toEqual(['Foo Bar', 'Baz']);
		// "bar" + "baz" joined would strip to "barbaz"; no single value has it.
		const s = compileSearch('barbaz')!;
		expect(strippedCandidates(row, altNames, opts)!.some((c) => s.stripped(c))).toBe(false);
	});

	it('lists each link label on its own', () => {
		const field = {
			key: 'ModelIncludedPen',
			label: 'Pen',
			getValue: () => 'x',
			type: 'string',
			group: 'Model',
		} as AnyFieldDisplayDef;
		const cellLinks: CellLinks = {
			ModelIncludedPen: () => [
				{ label: 'Pro Pen', href: '#' },
				{ label: '3D', href: '#' },
			],
		};
		const candidates = strippedCandidates({}, field, { ...opts, cellLinks })!;
		expect(candidates).toEqual(['x', 'Pro Pen', '3D']);
		expect(candidates.some((c) => compileSearch('pen3d')!.stripped(c))).toBe(false);
	});

	it('returns null for a non-identity field', () => {
		const dims = TABLET_FIELDS.find((f) => f.key === 'DigitizerDimensions') as AnyFieldDisplayDef;
		expect(strippedCandidates({}, dims, opts)).toBeNull();
	});
});

// The spec's examples, run through the same code path as /tablets against the
// real dataset and field definitions.
describe('applyTextSearch on real tablets (#327)', () => {
	let tablets: Tablet[];
	beforeAll(async () => {
		const ds = createDiskDataSet({
			dataDir: path.resolve(__dirname, '../../data-repo/data'),
			userId: 'sevenpens',
		});
		tablets = await ds.Tablets.toArray();
	});

	const visible = ['Brand', 'ModelName', 'ModelId', 'AlternateNames', 'DigitizerDimensions'].map(
		(k) => TABLET_FIELDS.find((f) => f.key === k) as AnyFieldDisplayDef,
	);
	const search = (q: string) =>
		applyTextSearch(
			tablets,
			q,
			visible,
			(row, f) => cellText(row, f, opts),
			(row, f) => strippedCandidates(row, f, opts),
		).map((t) => t.Model.Id);

	it.each(['ptk1240', 'PTK-1240', 'ptk 1240', 'PTK_1240'])('%s finds PTK-1240', (q) => {
		expect(search(q)).toContain('PTK-1240');
	});

	it('CD-120FH finds CD120FH (separators in the query)', () => {
		expect(search('CD-120FH')).toContain('CD120FH');
	});

	it('dtz2100d finds DTZ-2100 through its alternate name', () => {
		expect(search('dtz2100d')).toContain('DTZ-2100');
	});

	it('artist12 finds the Artist 12 family through Name', () => {
		expect(search('artist12')).toEqual(
			expect.arrayContaining(['ARTIST12', 'ARTIST12PRO', 'CD120FH', 'CD121FH']),
		);
	});

	it('1476 x 92.3 does NOT match CTE-450 through its dimensions', () => {
		// CTE-450 draws "147.6 x 92.3"; both strip to "1476x923".
		expect(search('1476 x 92.3')).not.toContain('CTE-450');
		// The exact text still works.
		expect(search('147.6 x 92.3')).toContain('CTE-450');
	});

	it('punctuation-only queries behave as a plain substring search', () => {
		expect(search('---')).toEqual(applyTextSearch(tablets, '---', visible).map((t) => t.Model.Id));
	});
});
