<script lang="ts">
	import ChartExportButton from '$lib/components/ChartExportButton.svelte';

	export interface Band {
		min: number;
		max: number | null; // null = "and above" (open-ended right edge)
		label: string;
	}

	let {
		bands,
		axisMax,
		axisStep = 1,
		unit,
		title,
		exportFilename,
	}: {
		bands: Band[];
		axisMax: number;
		axisStep?: number;
		unit: string;
		/** Used as the chart's export filename slug. */
		title?: string;
		/** Override the slug from `title` if you want a specific filename. */
		exportFilename?: string;
	} = $props();

	let svgEl: SVGElement | undefined = $state();

	// SVG geometry
	const W = 1000;
	const H = 220;
	const PAD_L = 40;
	const PAD_R = 40;
	const PAD_TOP = 80;
	const PAD_BOT = 50;
	const innerW = W - PAD_L - PAD_R;
	const axisY = H - PAD_BOT;

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
	>
		<rect x="0" y="0" width={W} height={H} fill="var(--bands-bg, #e5edf6)" />

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
</style>
