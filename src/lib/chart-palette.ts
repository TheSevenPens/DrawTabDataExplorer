/**
 * Shared categorical chart palette for the pressure-response chart and its
 * companion components (legend tables, colour swatches, etc).
 *
 * Picking colours at the parent level and threading them through both
 * `<PressureResponseChart>` and `<PressureResponseChartLegendTable>` keeps
 * swatches in the legend in sync with the lines on the chart.
 *
 * ── What these colours are for ───────────────────────────────────────────
 * These slots encode **identity** (which session / unit / model / tablet) and
 * nothing else. They are not status and not magnitude:
 *   - status  → --good / --warning / --danger  (see +layout.svelte)
 *   - ordinal → ValueHistogram / PressureBandsChart use one-hue ramps
 * A status colour must never impersonate a series, so the two vocabularies
 * stay separate on purpose.
 *
 * ── Why two arrays instead of one ────────────────────────────────────────
 * A palette has to sit inside a per-mode lightness band to stay legible:
 * OKLCH L 0.43–0.77 for the light ground, 0.48–0.67 for the dark one. One
 * array cannot satisfy both, so dark is *selected* — the same eight hue
 * families, stepped for the dark ground — rather than an automatic flip of
 * the light values.
 * A series keeps its hue family across themes, so "the magenta one" is the
 * same session in either theme.
 *
 * ── How these were derived (not hand-picked) ─────────────────────────────
 * Beam search over the authentic WP7/Metro accent hues, scored by the worst
 * all-pairs CVD ΔE (Machado-2009, protan + deuteranopia) in BOTH modes at
 * once, gated on the lightness band and the OKLCH chroma floor. All-pairs
 * rather than adjacent because the pressure-response chart is a scatter —
 * any two series can end up side by side, so an adjacent-only check would
 * hide a collapse. Slot 1 is pinned to the UI accent.
 *
 * Verified with the dataviz skill's validator, `--pairs all`:
 *   light (surface #efefef): all checks PASS, worst all-pairs ΔE 15.6
 *   dark  (surface #222222): all checks PASS, worst all-pairs ΔE 18.5
 * Re-run these whenever --bg changes: the surface is an input to the
 * contrast check (the mid-value grounds put more slots in the sub-3:1
 * WARN band than white/near-black did — legal only via the legend below).
 *
 * The palette this replaced failed outright: #ca8a04 and #d97706 collapsed
 * to ΔE 1.5 under deuteranopia — two sessions ~5% of men could not tell
 * apart. If you change a slot, re-run the validator; do not eyeball it.
 *
 * ── The contrast caveat this palette depends on ──────────────────────────
 * A few slots sit just under 3:1 against their surface (unavoidable while
 * holding CVD separation across eight hues). That is legal ONLY because the
 * chart always ships a `<PressureResponseChartLegendTable>` beside it, which
 * names every series and prints its values — identity is never colour-alone.
 * If you ever render one of these charts WITHOUT that legend table, this
 * palette is no longer accessible.
 */

export type ChartMode = 'light' | 'dark';

/** Hue families, in slot order. Both arrays below follow this order. */
export const CHART_PALETTE_FAMILIES = [
	'cyan',
	'orange',
	'indigo',
	'magenta',
	'crimson',
	'violet',
	'cobalt',
	'red',
] as const;

const LIGHT = [
	'#1373a2', // cyan — the UI accent
	'#fa6800', // orange
	'#6a00ff', // indigo
	'#d80073', // magenta
	'#a20025', // crimson
	'#7400b0', // violet
	'#006dff', // cobalt
	'#bf0f00', // red
] as const;

const DARK = [
	'#1a9ede', // cyan — the UI accent
	'#ee6300', // orange
	'#6a00ff', // indigo
	'#d80073', // magenta
	'#b3002a', // crimson
	'#8700cb', // violet
	'#006dff', // cobalt
	'#cf1100', // red
] as const;

/**
 * The tail colour. Slots are assigned in fixed order and never cycled: with
 * `i % 8`, a 9th series was handed slot 1's hue and two different sessions
 * became indistinguishable — the exact failure the palette exists to prevent.
 * Past the eighth, series share one deliberately neutral "other" grey, which
 * reads as "not separately identified" instead of impersonating slot 1. The
 * legend table still names every one of them. Tuned to the grounds: these
 * are drawn marks, so they clear ~4:1 (light) / ~4.6:1 (dark) rather than
 * fading into the surface.
 */
const OTHER: Record<ChartMode, string> = { light: '#767676', dark: '#8a8a8a' };

export function chartPalette(mode: ChartMode): readonly string[] {
	return mode === 'dark' ? DARK : LIGHT;
}

/** Colour for slot `index` in `mode`; the neutral "other" grey past slot 8. */
export function paletteColor(index: number, mode: ChartMode): string {
	return chartPalette(mode)[index] ?? OTHER[mode];
}

/** Slots available before a series folds into the neutral "other" grey. */
export const CHART_PALETTE_SIZE = LIGHT.length;
