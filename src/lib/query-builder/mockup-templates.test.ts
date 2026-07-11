import { describe, it, expect } from 'vitest';
import {
	BASIC_TEMPLATES,
	TEMPLATE_GROUPS,
	buildGroupedTemplates,
	type QueryBuilderTemplate,
} from './mockup-templates.js';

describe('buildGroupedTemplates — sync invariant', () => {
	it('groups every template exactly once with no orphans (real data)', () => {
		const grouped = buildGroupedTemplates();
		const flat = grouped.flatMap((g) => g.templates);
		expect(flat).toHaveLength(BASIC_TEMPLATES.length);
		expect(new Set(flat.map((t) => t.label)).size).toBe(BASIC_TEMPLATES.length);
		expect(grouped.map((g) => g.group)).toEqual(TEMPLATE_GROUPS.map((g) => g.group));
	});

	it('throws when a group references an unknown template label', () => {
		const all: QueryBuilderTemplate[] = [
			{
				label: 'A',
				collection: 'Tablets',
				filters: [],
				sorts: [],
				columns: [],
				output: { mode: 'toArray' },
			},
		];
		const groups = [{ group: 'G', labels: ['A', 'MISSING'] }];
		expect(() => buildGroupedTemplates(all, groups)).toThrow(/unknown template label: "MISSING"/);
	});

	it('throws when a template is missing from every group', () => {
		const all: QueryBuilderTemplate[] = [
			{
				label: 'A',
				collection: 'Tablets',
				filters: [],
				sorts: [],
				columns: [],
				output: { mode: 'toArray' },
			},
			{
				label: 'B',
				collection: 'Tablets',
				filters: [],
				sorts: [],
				columns: [],
				output: { mode: 'toArray' },
			},
		];
		const groups = [{ group: 'G', labels: ['A'] }];
		expect(() => buildGroupedTemplates(all, groups)).toThrow(/missing from TEMPLATE_GROUPS: "B"/);
	});
});
