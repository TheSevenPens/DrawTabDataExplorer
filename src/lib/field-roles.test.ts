import { describe, expect, it } from 'vitest';
import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
import { PEN_FIELDS } from '$data/lib/entities/pen-fields.js';
import {
	PEN_FIELD_ROLES,
	ROLE_KEYS,
	TABLET_FIELD_ROLES,
	comparableFields,
	fieldRole,
	type FieldRole,
} from './field-roles.js';

/**
 * Drift guards, not unit tests. The role map lives in this repo while the field
 * defs live in the `data-repo` submodule, so nothing but a test keeps the two
 * in step. A field added, renamed or removed upstream must break the build
 * rather than silently defaulting to a role.
 */
const CASES = [
	{ name: 'tablet', fields: TABLET_FIELDS, roles: TABLET_FIELD_ROLES, buckets: ROLE_KEYS.tablet },
	{ name: 'pen', fields: PEN_FIELDS, roles: PEN_FIELD_ROLES, buckets: ROLE_KEYS.pen },
] as const;

describe.each(CASES)('$name field roles vs upstream field defs', ({ fields, roles, buckets }) => {
	const upstream = fields.map((f) => f.key);

	it('classifies every upstream field', () => {
		const missing = upstream.filter((k) => fieldRole(roles, k) === undefined);
		expect(
			missing,
			`Unclassified field(s). Add each to the identity, spec or metadata list in field-roles.ts:\n  ${missing.join('\n  ')}`,
		).toEqual([]);
	});

	it('classifies nothing upstream no longer has', () => {
		const stale = Object.keys(roles).filter((k) => !upstream.includes(k));
		expect(
			stale,
			`Stale key(s) in field-roles.ts — renamed or removed upstream:\n  ${stale.join('\n  ')}`,
		).toEqual([]);
	});

	it('puts each key in exactly one bucket', () => {
		const all = [...buckets.identity, ...buckets.spec, ...buckets.metadata];
		expect(all.length).toBe(new Set(all).size);
	});
});

describe('what the compare pages depend on', () => {
	it('leaves a substantial majority of each entity comparable', () => {
		// Asserted per entity rather than inside describe.each: the two field
		// arrays have different item types, and a shared generic call site
		// collapses them to an unusable union.
		expect(comparableFields(TABLET_FIELDS, TABLET_FIELD_ROLES).length).toBeGreaterThan(50);
		expect(comparableFields(PEN_FIELDS, PEN_FIELD_ROLES).length).toBeGreaterThan(10);
	});

	it('excludes the tablet fields that only restate the column header', () => {
		// The compare table already prints tabletBrandAndName() per column, so a
		// Name / Entity ID / Brand row underneath is pure restatement.
		for (const key of [
			'EntityId',
			'FullName',
			'NameAndModelId',
			'Brand',
			'ModelId',
			'ModelName',
			'ModelProductLink',
			'LinkCount',
		]) {
			expect(fieldRole(TABLET_FIELD_ROLES, key), key).not.toBe('spec');
		}
	});

	it('leaves free-text notes as spec, so GitHub #309 stays live', () => {
		// /tablet-compare hides ModelNotes because nowrap cells blow the column
		// out, not because it is semantically uncomparable. Marking it metadata
		// here would make that workaround permanent and quietly moot the issue
		// tracking its removal.
		expect(fieldRole(TABLET_FIELD_ROLES, 'ModelNotes')).toBe('spec');
		expect(fieldRole(PEN_FIELD_ROLES, 'Notes')).toBe('spec');
	});

	it('excludes the same shape of field on pens, which previously excluded nothing', () => {
		// /pen-compare had no role filtering at all, so every comparison opened
		// with five rows restating the pen names in the column headers.
		for (const key of ['EntityId', 'FullName', 'Brand', 'PenId', 'PenName', 'Tags']) {
			expect(fieldRole(PEN_FIELD_ROLES, key), key).not.toBe('spec');
		}
	});

	it('keeps genuinely comparable Model-group fields as spec', () => {
		// Why group cannot stand in for a role: these sit in the same group as
		// the identity fields above.
		for (const key of [
			'ModelStatus',
			'ModelFamily',
			'ModelIncludedPen',
			'ModelReleaseYear',
			'LastSupportedWindowsDriver',
		]) {
			expect(fieldRole(TABLET_FIELD_ROLES, key), key).toBe('spec');
		}
		expect(fieldRole(PEN_FIELD_ROLES, 'IAF')).toBe('spec');
		expect(fieldRole(PEN_FIELD_ROLES, 'PenFamily')).toBe('spec');
	});
});

describe('comparableFields', () => {
	it('keeps an unclassified field rather than hiding a real difference', () => {
		const roles: Record<string, FieldRole> = { Known: 'identity' };
		const fields = [
			{ key: 'Known', label: 'Known', group: 'g', type: 'string' as const, getValue: () => '' },
			{ key: 'Mystery', label: 'Mystery', group: 'g', type: 'string' as const, getValue: () => '' },
		];
		expect(comparableFields(fields, roles).map((f) => f.key)).toEqual(['Mystery']);
	});

	it('drops identity and metadata', () => {
		const roles: Record<string, FieldRole> = { A: 'identity', B: 'metadata', C: 'spec' };
		const fields = ['A', 'B', 'C'].map((key) => ({
			key,
			label: key,
			group: 'g',
			type: 'string' as const,
			getValue: () => '',
		}));
		expect(comparableFields(fields, roles).map((f) => f.key)).toEqual(['C']);
	});
});
