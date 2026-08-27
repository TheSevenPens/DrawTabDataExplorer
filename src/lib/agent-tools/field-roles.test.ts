import { describe, expect, it } from 'vitest';
import { TABLET_FIELDS } from '$data/lib/entities/tablet-fields.js';
import { ROLE_KEYS, TABLET_FIELD_ROLES, tabletFieldRole } from './field-roles.js';

/**
 * These are drift guards, not unit tests. The role map lives in this repo while
 * the field defs live in the `data-repo` submodule, so nothing but a test keeps
 * the two in step. A field added, renamed or removed upstream must break the
 * build here rather than silently defaulting to a role — that silent default is
 * the whole failure mode this module exists to prevent.
 */
describe('tablet field roles vs upstream field defs', () => {
	const upstream = TABLET_FIELDS.map((f) => f.key);

	it('classifies every upstream field', () => {
		const missing = upstream.filter((k) => tabletFieldRole(k) === undefined);
		expect(
			missing,
			`Unclassified tablet field(s). Add each to IDENTITY, SPEC or METADATA in field-roles.ts:\n  ${missing.join('\n  ')}`,
		).toEqual([]);
	});

	it('classifies nothing that upstream no longer has', () => {
		const stale = Object.keys(TABLET_FIELD_ROLES).filter((k) => !upstream.includes(k));
		expect(
			stale,
			`Stale key(s) in field-roles.ts — renamed or removed upstream:\n  ${stale.join('\n  ')}`,
		).toEqual([]);
	});

	it('puts each key in exactly one bucket', () => {
		const all = [...ROLE_KEYS.identity, ...ROLE_KEYS.spec, ...ROLE_KEYS.metadata];
		expect(all.length).toBe(new Set(all).size);
	});
});

describe('the classification the A4 walkthrough depends on', () => {
	it('treats the fields that made the Kamvas diff 58% noise as non-spec', () => {
		// The seven rows that differed purely because the two tablets are
		// different products. If any of these becomes `spec`, the difference
		// table regresses to restating the question.
		for (const key of [
			'EntityId',
			'FullName',
			'NameAndModelId',
			'ModelId',
			'ModelName',
			'ModelProductLink',
			'LinkCount',
		]) {
			expect(tabletFieldRole(key), key).not.toBe('spec');
		}
	});

	it('keeps genuinely comparable Model-group fields as spec', () => {
		// The reason `group === 'Model'` cannot stand in for a role: these sit
		// in the same group as the identity fields above.
		for (const key of [
			'ModelStatus',
			'ModelFamily',
			'ModelIncludedPen',
			'ModelReleaseYear',
			'LastSupportedWindowsDriver',
		]) {
			expect(tabletFieldRole(key), key).toBe('spec');
		}
	});

	it('does not default unknown keys to a role', () => {
		expect(tabletFieldRole('NotAFieldKey')).toBeUndefined();
	});
});
