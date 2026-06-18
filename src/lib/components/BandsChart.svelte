<script lang="ts">
	import ChartExportButton from '$lib/components/ChartExportButton.svelte';
	import ChartFrame from '$lib/components/ChartFrame.svelte';
	import type { Band } from '$lib/bands.js';

	export interface BandMarker {
		/** Position on the same axis as `bands` (e.g. gram-force). */
		value: number;
		/** Optional label, shown above the line. */
		label?: string;
		/** Solid line if false; dashed if true (default true). */
		dashed?: boolean;
		/** SVG stroke-width (default 2). */
		strokeWidth?: number;
		/** Stroke color (default #dc2626 red). Used to distinguish markers
		 * for different pens / sessions when several are overlaid on one
		 * chart. */
		color?: string;
		/** When set together with `shadedRanges`, restricts the marker line
		 * to the vertical slice for that series (same slicing scheme as
		 * `shadedRanges`). Lets per-pen min/median/max markers stay aligned
		 * with their pen's shaded stripe instead of spanning the full chart.
		 *
		 * Use sparingly: this trades the chart's "shared-axis reading" (every
		 * marker spans the full height so values across pens are visually
		 * comparable) for stripe-affinity (each pen's markers stay in their
		 * own slice). Tried on /pen-compare's Pmax summary view and
		 * rolled back there — the shared-axis reading was the point. Kept as
		 * an API because it's the right choice when the per-series slice
		 * association matters more than cross-series value comparison. */
		seriesIndex?: number;
	}

	let {
		bands,
		axisMax,
		axisStep = 1,
		unit,
		showUnitInAxis = true,
		showBandRanges = true,
		title,
		heading,
		subtitle,
		exportFilename,
		markers = [],
		shadedRange,
		shadedRanges,
	}: {
		bands: Band[];
		axisMax: number;
		axisStep?: number;
		unit: string;
		/** Append the unit to each x-axis tick label (e.g. "0 gf"). Default
		 * true. Set false when the chart heading already names the unit and
		 * adding it to every tick would just create visual noise. */
		showUnitInAxis?: boolean;
		/** Render the "min ↔ max" numeric range under each band title
		 * (e.g. "0 ↔ 1" under "S"). Default true. Set false on detail-page
		 * embeds (PenDetail / PenFamilyDetail Piaf + Pmax tabs) where
		 * the band tiers are the takeaway and the exact cutoffs are just
		 * noise — they're still discoverable on the Reference page. */
		showBandRanges?: boolean;
		/** Used as the chart's export filename slug. */
		title?: string;
		/** Visible chart title rendered inside the SVG (so it appears in exports). */
		heading?: string;
		/** Optional secondary title rendered under the heading (smaller).
		 * Only shown when `heading` is also set. */
		subtitle?: string;
		/** Override the slug from `title` if you want a specific filename. */
		exportFilename?: string;
		/** Optional red dashed vertical lines drawn over the chart. */
		markers?: BandMarker[];
		/** Optional single semi-transparent red band drawn behind markers.
		 * Use this when there's only one range to show (e.g. min/max across
		 * a single pen model). For multiple ranges (one per pen in a merged
		 * comparison view) use `shadedRanges` instead. */
		shadedRange?: { min: number; max: number };
		/** Optional list of semi-transparent ranges, drawn as horizontal
		 * stripes so multiple pens' min/max bands don't pile up on each
		 * other. Each range gets its own vertical slice of the marker area.
		 * Color defaults to red if omitted, matching `shadedRange`. */
		shadedRanges?: { min: number; max: number; color?: string }[];
	} = $props();

	let svgEl: SVGElement | undefined = $state();

	// SVG geometry. When `heading` is set we add room at the top for the
	// title text so it's captured by SVG/PNG exports. A subtitle under
	// the heading widens the reserved band further.
	const W = 1000;
	const HEADING_BAND = 30;
	const SUBTITLE_BAND = 18;
	const headingOffset = $derived(
		(heading ? HEADING_BAND : 0) + (heading && subtitle ? SUBTITLE_BAND : 0),
	);
	const H = $derived(220 + headingOffset);
	const PAD_L = 40;
	const PAD_R = 40;
	const PAD_TOP = $derived(80 + headingOffset);
	const PAD_BOT = 50;
	const innerW = W - PAD_L - PAD_R;
	const axisY = $derived(H - PAD_BOT);

	function x(value: number): number {
		return PAD_L + (value / axisMax) * innerW;
	}

	// Marker-area vertical extent — shared by single-`shadedRange`, per-pen
	// `shadedRanges` stripes, and the marker lines themselves (which can be
	// bounded to a slice when both `seriesIndex` and `shadedRanges` are set).
	const markerBandTop = $derived(PAD_TOP + 30);
	const markerBandBot = $derived(axisY + 4);
	const markerSliceN = $derived(shadedRanges?.length ?? 0);
	const markerSliceH = $derived(
		markerSliceN > 0 ? (markerBandBot - markerBandTop) / markerSliceN : 0,
	);

	let ticks = $derived.by(() => {
		const out: number[] = [];
		for (let v = 0; v <= axisMax; v += axisStep) {
			// guard against floating-point drift accumulating past axisMax
			if (v <= axisMax + 1e-9) out.push(Math.round(v * 1e6) / 1e6);
		}
		return out;
	});

	// Resolve open-ended right edge for layout; clamp to axisMax.
	function bandRight(b: Band): number {
		return b.max === null ? axisMax : Math.min(b.max, axisMax);
	}
</script>

<div class="bands-chart-wrap">
	<ChartFrame>
		{#snippet actions()}
			<ChartExportButton
				getSvg={() => svgEl}
				title={title ?? 'bands-chart'}
				filename={exportFilename}
			/>
		{/snippet}
		<svg
			bind:this={svgEl}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 {W} {H}"
			class="bands-chart"
			role="img"
			aria-label="Range bands chart"
			font-family="'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
		>
			<rect x="0" y="0" width={W} height={H} fill="var(--bands-bg, #e5edf6)" />

			{#if heading}
				<text
					x={W / 2}
					y={22}
					text-anchor="middle"
					class="chart-heading"
					font-size="18"
					font-weight="700">{heading}</text
				>
				{#if subtitle}
					<text
						x={W / 2}
						y={42}
						text-anchor="middle"
						class="chart-subtitle"
						font-size="13"
						font-weight="400">{subtitle}</text
					>
				{/if}
			{/if}

			<!-- Vertical band-divider dashed lines. Drawn between adjacent bands,
			 and also at the leftmost band's lower bound when that bound is > 0
			 (e.g. Pmax ranking starts at 100 gf, not 0). -->
			{#each bands as b, i (i)}
				{#if i > 0 || b.min > 0}
					<line
						x1={x(b.min)}
						y1={PAD_TOP - 50}
						x2={x(b.min)}
						y2={axisY}
						stroke="var(--bands-divider, #6b94c2)"
						stroke-width="2"
						stroke-dasharray="6 4"
					/>
				{/if}
			{/each}

			<!-- Band labels (title + optional numeric range under it) -->
			{#each bands as b, i (i)}
				{@const cx = (x(b.min) + x(bandRight(b))) / 2}
				{@const rangeText = b.max === null ? `${b.min} ↔ ∞` : `${b.min} ↔ ${b.max}`}
				<text
					x={cx}
					y={PAD_TOP - 25}
					text-anchor="middle"
					class="band-label"
					font-weight="700"
					font-size="18">{b.label}</text
				>
				{#if showBandRanges}
					<text x={cx} y={PAD_TOP} text-anchor="middle" class="band-range" font-size="14"
						>{rangeText}</text
					>
				{/if}
			{/each}

			<!-- Main axis line -->
			<line
				x1={PAD_L}
				y1={axisY}
				x2={W - PAD_R}
				y2={axisY}
				stroke="var(--bands-axis, #111)"
				stroke-width="3"
			/>

			<!-- Tick marks + tick labels -->
			{#each ticks as t (t)}
				<line
					x1={x(t)}
					y1={axisY - 8}
					x2={x(t)}
					y2={axisY + 8}
					stroke="var(--bands-axis, #111)"
					stroke-width="2"
				/>
				<text x={x(t)} y={axisY + 28} text-anchor="middle" class="axis-tick" font-size="14"
					>{t}{showUnitInAxis ? ` ${unit}` : ''}</text
				>
			{/each}

			<!-- Optional shaded range (drawn behind markers) -->
			{#if shadedRange}
				{@const lo = Math.max(0, Math.min(shadedRange.min, shadedRange.max))}
				{@const hi = Math.min(axisMax, Math.max(shadedRange.min, shadedRange.max))}
				{#if hi > lo}
					<rect
						x={x(lo)}
						y={PAD_TOP + 30}
						width={x(hi) - x(lo)}
						height={axisY + 4 - (PAD_TOP + 30)}
						fill="#dc2626"
						fill-opacity="0.18"
					/>
				{/if}
			{/if}

			<!-- Optional per-pen shaded ranges, drawn as horizontal stripes so
			 multiple pens' min/max bands don't pile up on each other. -->
			{#if shadedRanges && shadedRanges.length > 0}
				{#each shadedRanges as r, i (i)}
					{@const lo = Math.max(0, Math.min(r.min, r.max))}
					{@const hi = Math.min(axisMax, Math.max(r.min, r.max))}
					{#if hi > lo}
						<rect
							x={x(lo)}
							y={markerBandTop + i * markerSliceH}
							width={x(hi) - x(lo)}
							height={markerSliceH}
							fill={r.color ?? '#dc2626'}
							fill-opacity="0.22"
						/>
					{/if}
				{/each}
			{/if}

			<!-- Red marker lines (e.g. measured Pmax values). When the marker
			 declares a seriesIndex AND shadedRanges is present, the line is
			 bounded to that pen's vertical slice (same slicing scheme as
			 the stripes above) so per-pen min/median/max stay aligned with
			 their stripe. -->
			{#each markers as m, i (i)}
				{#if m.value >= 0 && m.value <= axisMax}
					{@const sliced = m.seriesIndex !== undefined && markerSliceN > 0}
					{@const y1Val = sliced ? markerBandTop + m.seriesIndex! * markerSliceH : markerBandTop}
					{@const y2Val = sliced
						? markerBandTop + (m.seriesIndex! + 1) * markerSliceH
						: markerBandBot}
					<line
						x1={x(m.value)}
						y1={y1Val}
						x2={x(m.value)}
						y2={y2Val}
						stroke={m.color ?? '#dc2626'}
						stroke-width={m.strokeWidth ?? 2}
						stroke-dasharray={m.dashed === false ? undefined : '5 4'}
					/>
					{#if m.label}
						<text
							x={x(m.value)}
							y={PAD_TOP + 24}
							text-anchor="middle"
							class="marker-label"
							font-size="12"
							font-weight="600">{m.label}</text
						>
					{/if}
				{/if}
			{/each}
		</svg>
	</ChartFrame>
</div>

<style>
	.bands-chart-wrap {
		max-width: 1000px;
	}
	.bands-chart {
		width: 100%;
		height: auto;
		max-width: 1000px;
		display: block;
	}
	.band-label {
		fill: var(--text, #111);
	}
	.band-range {
		fill: var(--text, #111);
	}
	.axis-tick {
		fill: var(--text, #111);
	}
	.chart-heading {
		fill: var(--text, #111);
	}
	.chart-subtitle {
		fill: var(--text-muted, #555);
	}
	.marker-label {
		fill: #dc2626;
	}
</style>
