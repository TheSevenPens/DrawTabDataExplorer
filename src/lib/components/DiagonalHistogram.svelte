<script lang="ts">
	import { getDiagonal, type Tablet } from '$data/lib/drawtab-loader.js';

	let { tablet, allTablets }: {
		tablet: Tablet;
		allTablets: Tablet[];
	} = $props();

	const MM_TO_IN = 0.03937;

	interface SizeRange {
		label: string;
		min: number;
		max: number;
	}

	function getRanges(type: string): SizeRange[] {
		if (type === 'PENTABLET') {
			return [
				{ label: 'Small', min: 6, max: 9 },
				{ label: 'Medium', min: 10, max: 13 },
				{ label: 'Large', min: 14, max: 19 },
				{ label: 'XL', min: 20, max: 29 },
			];
		}
		return [
			{ label: 'Small', min: 11, max: 14 },
			{ label: 'Medium', min: 15, max: 19 },
			{ label: 'Large', min: 20, max: 29 },
			{ label: 'XL', min: 30, max: 33 },
		];
	}

	let ranges = $derived(getRanges(tablet.ModelType));

	// Get all diagonals for same type
	let diagonals = $derived(
		allTablets
			.filter(t => t.ModelType === tablet.ModelType)
			.map(t => {
				const d = getDiagonal(t.DigitizerDimensions);
				return d ? d * MM_TO_IN : null;
			})
			.filter((d): d is number => d !== null)
	);

	let thisDiagIn = $derived(() => {
		const d = getDiagonal(tablet.DigitizerDimensions);
		return d ? d * MM_TO_IN : null;
	});

	// Chart dimensions
	const width = 600;
	const height = 140;
	const padLeft = 30;
	const padRight = 20;
	const padTop = 30;
	const padBottom = 35;
	const chartW = width - padLeft - padRight;
	const chartH = height - padTop - padBottom;

	// Scale: min to max of all ranges
	let scaleMin = $derived(Math.min(...ranges.map(r => r.min)) - 1);
	let scaleMax = $derived(Math.max(...ranges.map(r => r.max)) + 1);

	function xScale(val: number): number {
		return padLeft + ((val - scaleMin) / (scaleMax - scaleMin)) * chartW;
	}

	// Histogram bins (1 inch per bin)
	let bins = $derived.by(() => {
		const binCount = Math.ceil(scaleMax - scaleMin);
		const counts: number[] = new Array(binCount).fill(0);
		for (const d of diagonals) {
			const idx = Math.floor(d - scaleMin);
			if (idx >= 0 && idx < binCount) counts[idx]++;
		}
		return counts;
	});

	let maxCount = $derived(Math.max(...bins, 1));

	let tx = $derived(thisDiagIn() !== null ? xScale(thisDiagIn()!) : 0);

	// Range colors
	const rangeColors = ['#dbeafe', '#bbf7d0', '#fef3c7', '#fecaca'];
</script>

{#if thisDiagIn()}
	<div class="histogram-container">
		<svg viewBox="0 0 {width} {height}" class="histogram">
			<!-- Range backgrounds -->
			{#each ranges as range, i}
				<rect
					x={xScale(range.min)}
					y={padTop}
					width={xScale(range.max) - xScale(range.min)}
					height={chartH}
					fill={rangeColors[i % rangeColors.length]}
					opacity="0.4"
				/>
				<text
					x={(xScale(range.min) + xScale(range.max)) / 2}
					y={padTop - 6}
					text-anchor="middle"
					font-size="10"
					fill="var(--text-muted)"
				>{range.label}</text>
				<text
					x={(xScale(range.min) + xScale(range.max)) / 2}
					y={height - 4}
					text-anchor="middle"
					font-size="9"
					fill="var(--text-dim)"
				>{range.min}″–{range.max}″</text>
			{/each}

			<!-- Histogram bars -->
			{#each bins as count, i}
				{#if count > 0}
					{@const barX = xScale(scaleMin + i)}
					{@const barW = xScale(scaleMin + i + 1) - barX - 1}
					{@const barH = (count / maxCount) * chartH * 0.85}
					<rect
						x={barX}
						y={padTop + chartH - barH}
						width={barW}
						height={barH}
						fill="var(--text-dim)"
						opacity="0.5"
						rx="1"
					/>
				{/if}
			{/each}

			<!-- Current tablet indicator -->
			<line
				x1={tx}
				y1={padTop - 2}
				x2={tx}
				y2={padTop + chartH + 2}
				stroke="#e11d48"
				stroke-width="2"
			/>
			<polygon
				points="{tx - 5},{padTop - 2} {tx + 5},{padTop - 2} {tx},{padTop + 5}"
				fill="#e11d48"
			/>
			<text
				x={tx}
				y={padTop - 10}
				text-anchor="middle"
				font-size="10"
				font-weight="bold"
				fill="#e11d48"
			>{thisDiagIn()!.toFixed(1)}″</text>
		</svg>
	</div>
{/if}

<style>
	.histogram-container {
		margin: 16px 0;
		max-width: 600px;
	}

	.histogram {
		width: 100%;
		height: auto;
	}
</style>
