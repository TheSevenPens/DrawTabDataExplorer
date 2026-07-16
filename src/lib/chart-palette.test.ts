import { describe, it, expect } from 'vitest';
import {
	chartPalette,
	paletteColor,
	CHART_PALETTE_SIZE,
	CHART_PALETTE_FAMILIES,
	type ChartMode,
} from './chart-palette.js';

const MODES: ChartMode[] = ['light', 'dark'];

describe('chartPalette', () => {
	it('has one colour per named hue family, in both modes', () => {
		for (const mode of MODES) {
			expect(chartPalette(mode)).toHaveLength(CHART_PALETTE_FAMILIES.length);
		}
		expect(CHART_PALETTE_SIZE).toBe(CHART_PALETTE_FAMILIES.length);
	});

	it('gives light and dark genuinely different steps', () => {
		// Dark is *selected* from the same hue families, not an automatic flip
		// of the light values — the two modes have different lightness bands.
		expect(chartPalette('dark')).not.toEqual(chartPalette('light'));
	});

	it('never repeats a colour within a mode', () => {
		for (const mode of MODES) {
			const p = chartPalette(mode);
			expect(new Set(p).size).toBe(p.length);
		}
	});

	it('emits well-formed hex', () => {
		for (const mode of MODES) {
			for (const c of chartPalette(mode)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});

describe('paletteColor', () => {
	it('returns each slot in fixed order', () => {
		for (const mode of MODES) {
			const p = chartPalette(mode);
			p.forEach((c, i) => expect(paletteColor(i, mode)).toBe(c));
		}
	});

	it('does NOT cycle past the last slot', () => {
		// Regression guard. The old implementation was `palette[i % len]`, so a
		// 9th series was handed slot 1's hue and two different sessions became
		// indistinguishable — the exact failure the palette exists to prevent.
		for (const mode of MODES) {
			expect(paletteColor(CHART_PALETTE_SIZE, mode)).not.toBe(paletteColor(0, mode));
			expect(paletteColor(CHART_PALETTE_SIZE + 1, mode)).not.toBe(paletteColor(1, mode));
		}
	});

	it('folds every overflow slot into one neutral "other", not a series hue', () => {
		for (const mode of MODES) {
			const other = paletteColor(CHART_PALETTE_SIZE, mode);
			expect(paletteColor(CHART_PALETTE_SIZE + 5, mode)).toBe(other);
			expect(chartPalette(mode)).not.toContain(other);
		}
	});

	it('always returns a usable colour, so a chart never renders colourless', () => {
		for (const mode of MODES) {
			for (const i of [0, 3, 7, 8, 99]) {
				expect(paletteColor(i, mode)).toMatch(/^#[0-9a-f]{6}$/);
			}
		}
	});

	it('pins slot 1 to the UI accent so the primary series matches the interface', () => {
		// These are the --accent values in +layout.svelte, stepped into each
		// mode's lightness band. If the accent moves, these move with it.
		expect(paletteColor(0, 'light')).toBe('#157db0');
		expect(paletteColor(0, 'dark')).toBe('#1a9ede');
	});
});
