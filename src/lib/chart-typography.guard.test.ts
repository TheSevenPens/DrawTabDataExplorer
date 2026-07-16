import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Guard: chart text must go through the single source (`chart-type.ts`),
 * not raw SVG font attributes or a hard-coded family. This is the
 * type-system equivalent of the palette validator — it stops the exact
 * regressions this work fixed from creeping back:
 *   - `font-size="12"` / `font-weight="600"` as SVG presentation attributes
 *     (bypasses the scale, and can't be audited by role)
 *   - `font-family="inherit"` (renders serif once exported — no ancestor)
 *   - the deleted 'Google Sans' face
 *
 * It intentionally does NOT police CSS `font-size: Npx` in HTML companion
 * tables — those follow the app-wide `:global(table)` convention and are a
 * separate concern from the SVG/canvas charts this guards.
 */
const CHART_SVG_COMPONENTS = [
	'src/lib/components/PressureBandsChart.svelte',
	'src/lib/components/ValueHistogram.svelte',
	'src/lib/components/TabletDimensionComparison.svelte',
	'src/lib/components/ForceProportionsView.svelte',
];

describe('chart SVG typography stays on the single source', () => {
	for (const path of CHART_SVG_COMPONENTS) {
		const src = readFileSync(path, 'utf8');

		it(`${path}: no raw font-size/weight SVG attributes`, () => {
			expect(src).not.toMatch(/font-size="[^"]*"/);
			expect(src).not.toMatch(/font-weight="[^"]*"/);
		});

		it(`${path}: no font-family="inherit" (breaks standalone export)`, () => {
			expect(src).not.toMatch(/font-family="inherit"/);
		});

		it(`${path}: no reference to the deleted Google Sans face`, () => {
			expect(src).not.toContain('Google Sans');
		});
	}
});
