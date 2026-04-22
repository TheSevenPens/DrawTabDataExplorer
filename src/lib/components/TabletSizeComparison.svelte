<script lang="ts">
	import { getDiagonal, brandName, type Tablet, type ISOPaperSize } from '$data/lib/drawtab-loader.js';
	import { unitPreference } from '$lib/unit-store.js';
	import { penTabletRangesCm, penTabletRangesIn, displayRangesCm, displayRangesIn, MM_TO_IN, MM_TO_CM } from '$lib/tablet-size-ranges.js';
	import ValueHistogram, { type HistogramRange } from '$lib/components/ValueHistogram.svelte';

	let { tablet, allTablets, isoSizes }: {
		tablet: Tablet;
		allTablets: Tablet[];
		isoSizes: ISOPaperSize[];
	} = $props();

	const currentYear = new Date().getFullYear();
	let compareYears = $state<number | null>(15);
	let isMetric = $derived($unitPreference === 'metric');

	let histogramRanges = $derived.by((): HistogramRange[] => {
		if (tablet.Model.Type === 'PENTABLET') return isMetric ? penTabletRangesCm : penTabletRangesIn;
		return isMetric ? displayRangesCm : displayRangesIn;
	});

	let histogramValues = $derived(
		allTablets
			.filter(t => {
				if (t.Model.Type !== tablet.Model.Type) return false;
				if (compareYears !== null) {
					const year = parseInt(t.Model.LaunchYear, 10);
					if (!isNaN(year) && year < currentYear - compareYears) return false;
				}
				return true;
			})
			.map(t => { const d = getDiagonal(t.Digitizer?.Dimensions); return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null; })
			.filter((d): d is number => d !== null)
	);

	let histogramCurrentValue = $derived.by(() => {
		const d = getDiagonal(tablet.Digitizer?.Dimensions);
		return d ? (isMetric ? d * MM_TO_CM : d * MM_TO_IN) : null;
	});

	let closestISO = $derived.by(() => {
		const diagMm = getDiagonal(tablet.Digitizer?.Dimensions);
		if (!diagMm) return null;
		const aSeries = isoSizes.filter(p => p.Series === 'A');
		if (aSeries.length === 0) return null;
		let best = aSeries[0];
		let bestDist = Infinity;
		for (const p of aSeries) {
			const pDiag = Math.sqrt(p.Width_mm ** 2 + p.Height_mm ** 2);
			const dist = Math.abs(pDiag - diagMm);
			if (dist < bestDist) { bestDist = dist; best = p; }
		}
		const bestDiag = Math.sqrt(best.Width_mm ** 2 + best.Height_mm ** 2);
		const pct = Math.round(Math.abs(diagMm - bestDiag) / bestDiag * 100);
		const qualifier = pct >= 1
			? (diagMm > bestDiag ? `${pct}% larger than ` : `${pct}% smaller than `)
			: '~ ';
		return `${qualifier}${best.Name}`;
	});

	let tabletLabel = $derived(`${brandName(tablet.Model.Brand)} ${tablet.Model.Name} (${tablet.Model.Id})`);
	let typeLabel = $derived(tablet.Model.Type === 'PENTABLET' ? 'pen tablets'
		: tablet.Model.Type === 'PENDISPLAY' ? 'pen displays'
		: 'standalone tablets');

	// --- ISO A Paper Size Chart ---
	const CHART_H = 200;
	const PAD_TOP = 26;  // room for labels above rects
	const PAD_BOT = 32;  // room for labels below rects
	const GAP = 10;      // px gap between rects

	interface ChartItem {
		label: string;
		dimsLabel: string;
		wMm: number;  // landscape orientation
		hMm: number;
		isTablet: boolean;
	}

	let dims = $derived(tablet.Digitizer?.Dimensions);

	let aSeries = $derived(
		isoSizes
			.filter(p => p.Series === 'A')
			.sort((a, b) => (b.Width_mm * b.Height_mm) - (a.Width_mm * a.Height_mm))
	);

	// Find closest A size index by area
	let closestISOIdx = $derived.by(() => {
		if (!dims || dims.Width == null || dims.Height == null || aSeries.length === 0) return -1;
		const tabArea = dims.Width * dims.Height;
		let best = 0, bestDist = Infinity;
		aSeries.forEach((p, i) => {
			const d = Math.abs(p.Width_mm * p.Height_mm - tabArea);
			if (d < bestDist) { bestDist = d; best = i; }
		});
		return best;
	});

	// Show 2 sizes larger and 3 sizes smaller than closest
	let isoSlice = $derived.by(() => {
		if (closestISOIdx === -1) return [];
		const start = Math.max(0, closestISOIdx - 2);
		const end = Math.min(aSeries.length - 1, closestISOIdx + 3);
		return aSeries.slice(start, end + 1);
	});

	let isoChartItems = $derived.by((): ChartItem[] => {
		if (!dims || dims.Width == null || dims.Height == null || isoSlice.length === 0) return [];
		const dw: number = dims.Width;
		const dh: number = dims.Height;
		const tabW = Math.max(dw, dh);
		const tabH = Math.min(dw, dh);
		const isoItems: ChartItem[] = isoSlice.map(p => ({
			label: p.Name,
			dimsLabel: `${p.Width_mm}×${p.Height_mm}`,
			wMm: Math.max(p.Width_mm, p.Height_mm),
			hMm: Math.min(p.Width_mm, p.Height_mm),
			isTablet: false,
		}));
		const tabItem: ChartItem = {
			label: 'Active Area',
			dimsLabel: `${dw}×${dh}`,
			wMm: tabW,
			hMm: tabH,
			isTablet: true,
		};
		return [...isoItems, tabItem]
			.sort((a, b) => (b.wMm * b.hMm) - (a.wMm * a.hMm));
	});

	interface ChartRect {
		x: number; sw: number; sh: number;
		isTablet: boolean; label: string; dimsLabel: string;
	}

	let isoChartLayout = $derived.by((): { rects: ChartRect[]; svgW: number } | null => {
		if (isoChartItems.length === 0) return null;
		const maxH = Math.max(...isoChartItems.map(it => it.hMm));
		const scale = CHART_H / maxH;
		let x = 0;
		const rects: ChartRect[] = isoChartItems.map(it => {
			const sw = Math.round(it.wMm * scale);
			const sh = Math.round(it.hMm * scale);
			const r: ChartRect = { x, sw, sh, isTablet: it.isTablet, label: it.label, dimsLabel: it.dimsLabel };
			x += sw + GAP;
			return r;
		});
		return { rects, svgW: x - GAP };
	});
</script>

<ValueHistogram
	title="{tabletLabel} active area diagonal compared to other {typeLabel}"
	values={histogramValues}
	currentValue={histogramCurrentValue}
	currentLabel={tabletLabel}
	ranges={histogramRanges}
	unit={isMetric ? ' cm' : '"'}
	binSize={isMetric ? 1 : 0.5}
	bandwidthMultiplier={0.2}
	bind:compareYears
/>

{#if closestISO}
	<p class="iso-note">Closest ISO paper size: <strong>{closestISO}</strong></p>
{/if}

{#if dims && isoChartLayout}
	<div class="iso-chart-section">
		<h3 class="iso-chart-title">Active Area vs ISO A Paper Sizes</h3>
		<div class="iso-chart-scroll">
			<svg
				width={isoChartLayout.svgW}
				height={CHART_H + PAD_TOP + PAD_BOT}
				role="img"
				aria-label="Active area size compared to ISO A paper sizes"
			>
				<g transform="translate(0,{PAD_TOP})">
					{#each isoChartLayout.rects as r}
						<!-- Rectangle -->
						<rect
							x={r.x}
							y={CHART_H - r.sh}
							width={r.sw}
							height={r.sh}
							class={r.isTablet ? 'rect-tablet' : 'rect-iso'}
						/>
						<!-- Name label: above the rect -->
						<text
							x={r.x + r.sw / 2}
							y={CHART_H - r.sh - 6}
							text-anchor="middle"
							class={r.isTablet ? 'chart-lbl-tablet' : 'chart-lbl-iso'}
						>{r.label}</text>
						<!-- Dimension label: below the baseline -->
						<text
							x={r.x + r.sw / 2}
							y={CHART_H + 14}
							text-anchor="middle"
							class="chart-lbl-dims"
						>{r.dimsLabel}</text>
					{/each}
					<!-- Baseline -->
					<line x1="0" y1={CHART_H} x2={isoChartLayout.svgW} y2={CHART_H} class="chart-baseline" />
				</g>
			</svg>
		</div>
	</div>
{/if}

<style>
	.iso-note {
		margin-top: 10px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.iso-chart-section {
		margin-top: 24px;
	}

	.iso-chart-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		margin: 0 0 10px;
	}

	.iso-chart-scroll {
		overflow-x: auto;
		padding-bottom: 4px;
	}

	.rect-iso {
		fill: var(--bg-card);
		stroke: var(--border);
		stroke-width: 1;
	}

	.rect-tablet {
		fill: #dbeafe;
		stroke: #2563eb;
		stroke-width: 1.5;
	}

	:global([data-theme='dark']) .rect-tablet {
		fill: #1e3a5f;
		stroke: #60a5fa;
	}

	:global([data-theme='dark']) .rect-iso {
		fill: #1f2937;
		stroke: #374151;
	}

	.chart-lbl-iso {
		font-size: 11px;
		fill: var(--text-muted);
		font-family: inherit;
	}

	.chart-lbl-tablet {
		font-size: 11px;
		font-weight: 700;
		fill: #2563eb;
		font-family: inherit;
	}

	:global([data-theme='dark']) .chart-lbl-tablet {
		fill: #60a5fa;
	}

	.chart-lbl-dims {
		font-size: 10px;
		fill: var(--text-dim);
		font-family: inherit;
	}

	.chart-baseline {
		stroke: var(--border);
		stroke-width: 1;
	}
</style>
