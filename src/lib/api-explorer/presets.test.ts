import { describe, it, expect } from 'vitest';
import {
	presets,
	PRESET_GROUPS,
	renderPreset,
	buildGroupedPresets,
	type Preset,
} from './presets.js';

describe('renderPreset', () => {
	it('prefixes the body with the label as a comment', () => {
		const p: Preset = { label: 'My example', body: 'return 1;' };
		expect(renderPreset(p)).toBe('// My example\nreturn 1;');
	});
});

describe('buildGroupedPresets — sync invariant', () => {
	it('groups every preset exactly once with no orphans (real data)', () => {
		const grouped = buildGroupedPresets();
		const flat = grouped.flatMap((g) => g.presets);
		// Every preset appears, and none twice.
		expect(flat).toHaveLength(presets.length);
		expect(new Set(flat.map((p) => p.label)).size).toBe(presets.length);
		// Group order matches PRESET_GROUPS order.
		expect(grouped.map((g) => g.group)).toEqual(PRESET_GROUPS.map((g) => g.group));
	});

	it('throws when a group references an unknown preset label', () => {
		const all: Preset[] = [{ label: 'A', body: '' }];
		const groups = [{ group: 'G', labels: ['A', 'MISSING'] }];
		expect(() => buildGroupedPresets(all, groups)).toThrow(/unknown preset label: "MISSING"/);
	});

	it('throws when a preset is missing from every group', () => {
		const all: Preset[] = [
			{ label: 'A', body: '' },
			{ label: 'B', body: '' },
		];
		const groups = [{ group: 'G', labels: ['A'] }];
		expect(() => buildGroupedPresets(all, groups)).toThrow(/missing from PRESET_GROUPS: "B"/);
	});
});
