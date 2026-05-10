<script lang="ts">
	import ChartExportButton from '$lib/components/ChartExportButton.svelte';

	export interface Band {
		min: number;
		max: number | null; // null = "and above" (open-ended right edge)
		label: string;
	}

	export interface BandMarker {
		/** Position on the same axis as `bands` (e.g. gram-force). */
		value: number;
		/** Optional label, shown above the line. */
		label?: string;
		/** Solid line if false; dashed if true (default true). */
		dashed?: boolean;
		/** SVG stroke-width (default 2). */
		strokeWidth?: number;
	}

	let {
		bands,
		axisMax,
		axisStep = 1,
		unit,
		title,
		heading,
		exportFilename,
		markers = [],
		shadedRange,
	}: {
		bands: Band[];
		axisMax: number;
		axisStep?: number;
		unit: string;
		/** Used as the chart's export filename slug. */
		title?: string;
		/** Visible chart title rendered inside the SVG (so it appears in exports). */
		heading?: string;
		/** Override the slug from `title` if you want a specific filename. */
		exportFilename?: string;
		/** Optional red dashed vertical lines drawn over the chart. */
		markers?: BandMarker[];
		/** Optional semi-transparent red band drawn behind markers. */
		shadedRange?: { min: number; max: number };
	} = $props();

	let svgEl: SVGElement | undefined = $state();

	// SVG geometry. When `heading` is set we add room at the top for the
	// title text so it's captured by SVG/PNG exports.
	const W = 1000;
	const HEADING_BAND = 30;
	const headingOffset = $derived(heading ? HEADING_BAND : 0);
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
	<div class="export-row">
		<ChartExportButton
			getSvg={() => svgEl}
			title={title ?? 'bands-chart'}
			filename={exportFilename}
		/>
	</div>
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
		{/if}

		<!-- Vertical band-divider dashed lines (between adjacent bands) -->
		{#each bands as b, i}
			{#if i > 0}
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

		<!-- Band labels (title + range) -->
		{#each bands as b}
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
			<text x={cx} y={PAD_TOP} text-anchor="middle" class="band-range" font-size="14"
				>{rangeText}</text
			>
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
		{#each ticks as t}
			<line
				x1={x(t)}
				y1={axisY - 8}
				x2={x(t)}
				y2={axisY + 8}
				stroke="var(--bands-axis, #111)"
				stroke-width="2"
			/>
			<text x={x(t)} y={axisY + 28} text-anchor="middle" class="axis-tick" font-size="14"
				>{t} {unit}</text
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

		<!-- Red marker lines (e.g. measured P100 values) -->
		{#each markers as m}
			{#if m.value >= 0 && m.value <= axisMax}
				<line
					x1={x(m.value)}
					y1={PAD_TOP + 30}
					x2={x(m.value)}
					y2={axisY + 4}
					stroke="#dc2626"
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
</div>

<style>
	.bands-chart-wrap {
		max-width: 1000px;
	}
	.export-row {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
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
	.marker-label {
		fill: #dc2626;
	}
</style>
