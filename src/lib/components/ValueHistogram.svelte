<script lang="ts">
	export interface HistogramRange {
		label: string;
		min: number;
		max: number;
	}

	export interface HistogramMarker {
		value: number;
		label: string;
	}

	let { title = '', values, currentValue, currentLabel = '', ranges, unit = '"', binSize = 0.5, chartHeight = 280, bandwidthMultiplier = 1.0, compareYears = $bindable<number | null | undefined>(undefined), compareYearOptions = [10, 15, 20, null] as (number | null)[], markers = [] as HistogramMarker[] }: {
		title?: string;
		values: number[];
		currentValue: number | null;
		currentLabel?: string;
		ranges: HistogramRange[];
		unit?: string;
		binSize?: number;
		chartHeight?: number;
		bandwidthMultiplier?: number;
		compareYears?: number | null | undefined;
		compareYearOptions?: (number | null)[];
		markers?: HistogramMarker[];
	} = $props();

	const width = 900;
	const padLeft = 30;
	const padRight = 20;
	let titleHeight = $derived(title ? 28 : 0);
	let padTop = $derived(40 + titleHeight);
	const padBottom = 65;
	let markerExtraHeight = $derived(markers.length > 0 ? (Math.min(MARKER_TIERS, markers.length) - 1) * 14 + 10 : 0);
	let totalHeight = $derived(chartHeight + titleHeight + markerExtraHeight);
	let chartW = $derived(width - padLeft - padRight);
	let chartH = $derived(chartHeight - 40 - padBottom);

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

	// Stagger marker labels to avoid overlap
	const CHAR_WIDTH = 5.5; // approx px per char at font-size 10
	const LABEL_PAD = 8; // extra gap between labels
	const MARKER_TIERS = 4;
	let positionedMarkers = $derived.by(() => {
		const visible = markers
			.filter(m => m.value >= scaleMin && m.value <= scaleMax)
			.map(m => ({ ...m, x: xScale(m.value), labelW: m.label.length * CHAR_WIDTH }))
			.sort((a, b) => a.x - b.x);
		// Track the right edge (anchor x) of the last label placed on each tier.
		// Labels are right-aligned, so a label at x spans [x - labelW, x].
		// A new label fits on tier i when two conditions hold:
		//   1. Its left edge clears the previous label on that tier (no text overlap).
		//   2. No already-placed marker's vertical line passes through its text span
		//      (a line at px would intersect the label if px >= m.x - m.labelW).
		const tierRightEdge = new Array(MARKER_TIERS).fill(-Infinity);
		const placedX: number[] = [];
		return visible.map(m => {
			let tier = MARKER_TIERS - 1; // fallback: deepest tier
			for (let i = 0; i < MARKER_TIERS; i++) {
				const noTextOverlap = m.x - m.labelW >= tierRightEdge[i] + LABEL_PAD;
				const noLineCrossing = placedX.every(px => px < m.x - m.labelW - LABEL_PAD);
				if (noTextOverlap && noLineCrossing) { tier = i; break; }
			}
			tierRightEdge[tier] = m.x;
			placedX.push(m.x);
			return { ...m, tier };
		});
	});

	let svgEl: SVGSVGElement | undefined = $state();
	let copyStatus = $state('');

	async function copyAsImage() {
		if (!svgEl) return;
		try {
			const serialized = new XMLSerializer().serializeToString(svgEl);
			const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
			const url = URL.createObjectURL(svgBlob);
			const img = new Image();
			img.src = url;
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('image load failed'));
			});
			const scale = 2;
			const canvas = document.createElement('canvas');
			canvas.width = width * scale;
			canvas.height = totalHeight * scale;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('no 2d context');
			ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card') || '#fff';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(url);
			const blob: Blob = await new Promise((resolve, reject) => {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
			});
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			copyStatus = 'Copied!';
		} catch (err) {
			copyStatus = 'Copy failed';
			console.error(err);
		}
		setTimeout(() => (copyStatus = ''), 2000);
	}
</script>

{#if values.length > 0}
	<div class="histogram-container">
		<div class="histogram-toolbar">
			{#if compareYears !== undefined}
				<label class="compare-label">
					Compare to tablets released in last:
					<select class="compare-select" bind:value={compareYears}>
						{#each compareYearOptions as opt}
							<option value={opt}>{opt !== null ? `${opt} years` : 'all time'}</option>
						{/each}
					</select>
				</label>
			{/if}
			<button type="button" class="copy-btn" onclick={copyAsImage} title="Copy histogram as image">
				{copyStatus || 'Copy as image'}
			</button>
		</div>
		<svg bind:this={svgEl} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {totalHeight}" class="histogram" style="font-family: 'Google Sans', sans-serif;">
			{#if title}
				<text
					x={width / 2}
					y={20}
					text-anchor="middle"
					font-size="14"
					font-weight="600"
					fill="var(--text)"
				>{title}</text>
			{/if}
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
					y={padTop - 24}
					text-anchor="middle"
					font-size="12"
					fill="var(--text-muted)"
				>{range.label}</text>
				<text
					x={(xScale(range.min) + xScale(range.max)) / 2}
					y={padTop - 10}
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

			<!-- Markers -->
			{#each positionedMarkers as marker}
				{@const labelY = padTop + chartH + 42 + marker.tier * 14}
				<line
					x1={marker.x}
					y1={padTop - 8}
					x2={marker.x}
					y2={labelY - 4}
					stroke="#e11d48"
					stroke-width="1.5"
					stroke-dasharray="4 3"
					opacity="0.7"
				/>
				<text
					x={marker.x - 4}
					y={labelY}
					text-anchor="end"
					font-size="10"
					font-weight="600"
					fill="#e11d48"
				>{marker.label}</text>
			{/each}

			<!-- Current value indicator -->
			{#if currentValue !== null}
				<line
					x1={tx}
					y1={padTop - 8}
					x2={tx}
					y2={padTop + chartH + 30}
					stroke="#e11d48"
					stroke-width="2"
				/>
				<text
					x={tx}
					y={padTop + chartH + 42}
					text-anchor="middle"
					font-size="12"
					font-weight="bold"
					fill="#e11d48"
				>{currentValue.toFixed(1)}{unit}</text>
				{#if currentLabel}
					<text
						x={tx}
						y={padTop + chartH + 56}
						text-anchor="middle"
						font-size="11"
						fill="#e11d48"
					>{currentLabel}</text>
				{/if}
			{/if}
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

	.histogram-toolbar {
		width: 900px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		margin-bottom: 4px;
	}

	.compare-label {
		font-size: 13px;
		color: var(--text);
		display: flex;
		align-items: center;
		gap: 4px;
		margin-right: auto;
	}

	.compare-select {
		font-size: 13px;
		padding: 2px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}

	.copy-btn {
		font-size: 12px;
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
		cursor: pointer;
	}

	.copy-btn:hover {
		background: var(--hover-bg);
	}
</style>
