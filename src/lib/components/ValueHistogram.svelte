<script lang="ts">
	export interface HistogramRange {
		label: string;
		min: number;
		max: number;
	}

	let { values, currentValue, ranges, unit = '"', binSize = 0.5, chartHeight = 280, bandwidthMultiplier = 1.0 }: {
		values: number[];
		currentValue: number | null;
		ranges: HistogramRange[];
		unit?: string;
		binSize?: number;
		chartHeight?: number;
		bandwidthMultiplier?: number;
	} = $props();

	const width = 900;
	const padLeft = 30;
	const padRight = 20;
	const padTop = 40;
	const padBottom = 50;
	let chartW = $derived(width - padLeft - padRight);
	let chartH = $derived(chartHeight - padTop - padBottom);

	let scaleMin = $derived(Math.min(...ranges.map(r => r.min)) - 1);
	let scaleMax = $derived(Math.max(...ranges.map(r => r.max)) + 1);

	function xScale(val: number): number {
		return padLeft + ((val - scaleMin) / (scaleMax - scaleMin)) * chartW;
	}

	let bins = $derived.by(() => {
		const binCount = Math.ceil((scaleMax - scaleMin) / binSize);
		const counts: number[] = new Array(binCount).fill(0);
		for (const d of values) {
			const idx = Math.floor((d - scaleMin) / binSize);
			if (idx >= 0 && idx < binCount) counts[idx]++;
		}
		return counts;
	});

	let maxCount = $derived(Math.max(...bins, 1));

	// KDE (Kernel Density Estimation)
	let kdePath = $derived.by(() => {
		if (values.length < 2) return '';
		// Silverman's rule of thumb for bandwidth
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
		const std = Math.sqrt(variance) || 1;
		const bandwidth = 1.06 * std * Math.pow(values.length, -0.2) * bandwidthMultiplier;

		const steps = 200;
		const stepSize = (scaleMax - scaleMin) / steps;
		const densities: number[] = [];

		for (let i = 0; i <= steps; i++) {
			const x = scaleMin + i * stepSize;
			let density = 0;
			for (const v of values) {
				const z = (x - v) / bandwidth;
				density += Math.exp(-0.5 * z * z);
			}
			density /= values.length * bandwidth * Math.sqrt(2 * Math.PI);
			densities.push(density);
		}

		const maxDensity = Math.max(...densities);
		if (maxDensity === 0) return '';

		// Scale density to chart height (use 85% like bars)
		const points = densities.map((d, i) => {
			const x = xScale(scaleMin + i * stepSize);
			const y = padTop + chartH - (d / maxDensity) * chartH * 0.85;
			return `${x},${y}`;
		});

		// Close the path along the bottom
		const firstX = xScale(scaleMin);
		const lastX = xScale(scaleMax);
		const bottom = padTop + chartH;
		return `M${firstX},${bottom} L${points.join(' L')} L${lastX},${bottom} Z`;
	});

	let tickStep = $derived((scaleMax - scaleMin) > 40 ? 5 : 2);
	let tickStart = $derived(Math.ceil(scaleMin / tickStep) * tickStep);
	let tickCount = $derived(Math.floor((scaleMax - tickStart) / tickStep) + 1);
	let tx = $derived(currentValue !== null ? xScale(currentValue) : 0);

	const rangeOpacities = [0.2, 0.35, 0.2, 0.35];
</script>

{#if currentValue !== null}
	<div class="histogram-container">
		<svg viewBox="0 0 {width} {chartHeight}" class="histogram" style="font-family: 'Google Sans', sans-serif;">
			<!-- Range backgrounds -->
			{#each ranges as range, i}
				<rect
					x={xScale(range.min)}
					y={padTop}
					width={xScale(range.max) - xScale(range.min)}
					height={chartH}
					fill="#3b82f6"
					opacity={rangeOpacities[i % rangeOpacities.length]}
				/>
				<text
					x={(xScale(range.min) + xScale(range.max)) / 2}
					y={padTop - 16}
					text-anchor="middle"
					font-size="12"
					fill="var(--text-muted)"
				>{range.label}</text>
				<text
					x={(xScale(range.min) + xScale(range.max)) / 2}
					y={padTop - 4}
					text-anchor="middle"
					font-size="10"
					fill="var(--text-dim)"
				>{range.min}{unit}–{range.max}{unit}</text>
			{/each}

			<!-- X axis -->
			<line
				x1={padLeft}
				y1={padTop + chartH}
				x2={padLeft + chartW}
				y2={padTop + chartH}
				stroke="var(--text-dim)"
				stroke-width="1"
			/>
			{#each Array(tickCount) as _, i}
				{@const val = tickStart + i * tickStep}
				{#if val >= scaleMin && val <= scaleMax}
					<line
						x1={xScale(val)}
						y1={padTop + chartH}
						x2={xScale(val)}
						y2={padTop + chartH + 4}
						stroke="var(--text-dim)"
						stroke-width="1"
					/>
					<text
						x={xScale(val)}
						y={padTop + chartH + 15}
						text-anchor="middle"
						font-size="11"
						fill="var(--text-dim)"
					>{val}{unit}</text>
				{/if}
			{/each}


			<!-- Histogram bars -->
			{#each bins as count, i}
				{#if count > 0}
					{@const barX = xScale(scaleMin + i * binSize)}
					{@const barW = xScale(scaleMin + (i + 1) * binSize) - barX - 1}
					{@const barH = (count / maxCount) * chartH * 0.85}
					<rect
						x={barX}
						y={padTop + chartH - barH}
						width={barW}
						height={barH}
						fill="#1e3a5f"
						opacity="0.85"
						rx="1"
					/>
				{/if}
			{/each}

			<!-- KDE curve (in front of bars) -->
			{#if kdePath}
				<path d={kdePath} fill="#0d9488" opacity="0.15" />
				<path d={kdePath} fill="none" stroke="#0d9488" stroke-width="2" opacity="0.7" />
			{/if}

			<!-- Current value indicator -->
			<line
				x1={tx}
				y1={padTop}
				x2={tx}
				y2={padTop + chartH}
				stroke="#e11d48"
				stroke-width="2"
			/>
			<text
				x={tx}
				y={padTop + chartH + 28}
				text-anchor="middle"
				font-size="12"
				font-weight="bold"
				fill="#e11d48"
			>{currentValue!.toFixed(1)}{unit}</text>
		</svg>
	</div>
{/if}

<style>
	.histogram-container {
		margin: 16px 0;
		overflow-x: auto;
	}

	.histogram {
		width: 900px;
		height: auto;
	}
</style>
