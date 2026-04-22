<script lang="ts">
	import type { Dimensions, ISOPaperSize } from '$data/lib/drawtab-loader.js';

	let { dims, isoSizes }: {
		dims: Dimensions | undefined;
		isoSizes: ISOPaperSize[];
	} = $props();

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

	interface ChartRect {
		x: number; sw: number; sh: number;
		isTablet: boolean; label: string; dimsLabel: string;
	}

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

	let chartItems = $derived.by((): ChartItem[] => {
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
		return [...isoItems, tabItem].sort((a, b) => (b.wMm * b.hMm) - (a.wMm * a.hMm));
	});

	let layout = $derived.by((): { rects: ChartRect[]; svgW: number } | null => {
		if (chartItems.length === 0) return null;
		const maxH = Math.max(...chartItems.map(it => it.hMm));
		const scale = CHART_H / maxH;
		let x = 0;
		const rects: ChartRect[] = chartItems.map(it => {
			const sw = Math.round(it.wMm * scale);
			const sh = Math.round(it.hMm * scale);
			const r: ChartRect = { x, sw, sh, isTablet: it.isTablet, label: it.label, dimsLabel: it.dimsLabel };
			x += sw + GAP;
			return r;
		});
		return { rects, svgW: x - GAP };
	});
</script>

{#if layout}
	<div class="iso-chart-scroll">
		<svg
			width={layout.svgW}
			height={CHART_H + PAD_TOP + PAD_BOT}
			role="img"
			aria-label="Active area size compared to ISO A paper sizes"
		>
			<g transform="translate(0,{PAD_TOP})">
				{#each layout.rects as r}
					<rect
						x={r.x}
						y={CHART_H - r.sh}
						width={r.sw}
						height={r.sh}
						class={r.isTablet ? 'rect-tablet' : 'rect-iso'}
					/>
					<text
						x={r.x + r.sw / 2}
						y={CHART_H - r.sh - 6}
						text-anchor="middle"
						class={r.isTablet ? 'lbl-tablet' : 'lbl-iso'}
					>{r.label}</text>
					<text
						x={r.x + r.sw / 2}
						y={CHART_H + 14}
						text-anchor="middle"
						class="lbl-dims"
					>{r.dimsLabel}</text>
				{/each}
				<line x1="0" y1={CHART_H} x2={layout.svgW} y2={CHART_H} class="baseline" />
			</g>
		</svg>
	</div>
{/if}

<style>
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

	.lbl-iso {
		font-size: 11px;
		fill: var(--text-muted);
		font-family: inherit;
	}

	.lbl-tablet {
		font-size: 11px;
		font-weight: 700;
		fill: #2563eb;
		font-family: inherit;
	}

	:global([data-theme='dark']) .lbl-tablet {
		fill: #60a5fa;
	}

	.lbl-dims {
		font-size: 10px;
		fill: var(--text-dim);
		font-family: inherit;
	}

	.baseline {
		stroke: var(--border);
		stroke-width: 1;
	}
</style>
