/**
 * Single source of truth for chart typography.
 *
 * Chart text renders on four surfaces, each with a different mechanism:
 *   - HTML/CSS (legend tables, ChartFrame chrome) — uses `var(--type-*)`
 *     directly; not this file's concern.
 *   - In-document SVG `<text>` — uses `svgTextStyle(role)` below.
 *   - Standalone SVG / PNG export — a serialized clone with no `:root`, so
 *     it can't resolve `var()`. The literal px + explicit family that
 *     `svgTextStyle` bakes as an inline style survive serialization; the
 *     export flatten in ChartExportButton handles the colours.
 *   - Chart.js canvas — pure JS, no CSS; consumes `chartJsFont(role)` and
 *     `CHART_FONT_FAMILY` via `Chart.defaults`.
 *
 * The rule that makes this auditable: **a chart names a role, never a raw
 * number.** `chart-type.test.ts` guards it, and `.eslintrc`-style greps
 * for `font-size=` in chart components would catch a regression. To change
 * how any chart text looks, change the role here — once.
 *
 * Sizes mirror the `--type-*` scale in `src/routes/+layout.svelte`; the
 * test asserts they stay in sync so the chart layer can't drift from the
 * rest of the app.
 */

/** The chart typeface. Matches the body stack in `app.html` (Open Sans,
 * same designer + skeleton as Segoe UI). Baked onto exported SVG and set as
 * the Chart.js default so canvas and rasterised exports render in it rather
 * than a serif fallback. */
export const CHART_FONT_FAMILY =
	"'Open Sans', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif";

/** Mirror of the `--type-*` steps this file uses. `chart-type.test.ts`
 * asserts each equals its CSS token, so the two representations can't drift. */
export const TYPE_SCALE = {
	subhead: 18,
	body: 14,
	caption: 12,
	micro: 11,
} as const;

/** Mirror of the `--track-wide` value (Metro's caps-label tracking). */
export const TRACK_WIDE = 0.12;

export interface ChartTypeRole {
	/** px — always a `TYPE_SCALE` step. */
	size: number;
	weight: number;
	/** em; 0 = default tracking. */
	tracking: number;
	/** Metro wide-tracked caps, for small annotation labels. Rendered via
	 * `text-transform` so the DOM keeps the authored case for a11y. */
	upper: boolean;
}

/**
 * The roles. Every chart label is one of these — pick by the job it does,
 * not by how big you want it.
 */
export const CHART_TYPE = {
	/** The chart's own heading, rendered inside the SVG so it survives export. */
	title: { size: TYPE_SCALE.subhead, weight: 600, tracking: -0.015, upper: false },
	/** A muted line under the title (counts, units, "n = …"). */
	subtitle: { size: TYPE_SCALE.caption, weight: 400, tracking: 0, upper: false },
	/** Axis name, or a prominent label centred inside a shape ("16:10"). */
	axisTitle: { size: TYPE_SCALE.caption, weight: 600, tracking: 0, upper: false },
	/** Numbers along an axis. */
	axisTick: { size: TYPE_SCALE.micro, weight: 400, tracking: 0, upper: false },
	/** A prominent graded rating shown large (the S/A/B/C/D tier letters). */
	zoneTier: { size: TYPE_SCALE.subhead, weight: 600, tracking: 0, upper: false },
	/** A small graded category name (TINY / SMALL / …) — Metro tracked caps. */
	zoneLabel: { size: TYPE_SCALE.micro, weight: 600, tracking: TRACK_WIDE, upper: true },
	/** A label attached to a mark or series. */
	seriesLabel: { size: TYPE_SCALE.micro, weight: 600, tracking: 0, upper: false },
	/** A callout on the plot — "Median", "17.9 cm". */
	annotation: { size: TYPE_SCALE.micro, weight: 600, tracking: 0, upper: false },
} satisfies Record<string, ChartTypeRole>;

export type ChartTypeName = keyof typeof CHART_TYPE;

/**
 * Inline `style` string for an SVG `<text>` in `role`.
 *
 * Literal px (not `var(--type-*)`) on purpose: the export serialises a
 * detached clone with no `:root`, so a token wouldn't resolve. Family is
 * included so a rasterised export renders in Open Sans. Sizes are
 * theme-independent, so the literal is correct on screen and in export
 * alike — no flatten needed for type (only colour is themed).
 */
export function svgTextStyle(role: ChartTypeName): string {
	const r = CHART_TYPE[role];
	return [
		`font-family:${CHART_FONT_FAMILY}`,
		`font-size:${r.size}px`,
		`font-weight:${r.weight}`,
		r.tracking ? `letter-spacing:${r.tracking}em` : '',
		r.upper ? 'text-transform:uppercase' : '',
	]
		.filter(Boolean)
		.join(';');
}

/** Chart.js `font` object for `role` (used on scale titles, ticks, tooltips). */
export function chartJsFont(role: ChartTypeName): { family: string; size: number; weight: number } {
	const r = CHART_TYPE[role];
	return { family: CHART_FONT_FAMILY, size: r.size, weight: r.weight };
}
