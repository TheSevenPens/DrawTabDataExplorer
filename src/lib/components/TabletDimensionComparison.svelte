<script lang="ts">
	import type { Dimensions, ISOPaperSize } from '$data/lib/drawtab-loader.js';

	let { dims, items, isoSizes = [], showISO = true, stacked = false }: {
		dims?: Dimensions;
		items?: Array<{ dims: Dimensions; label: string }>;
		isoSizes?: ISOPaperSize[];
		showISO?: boolean;
		stacked?: boolean;
	} = $props();

	const STACK_FILLS   = ['#dbeafe', '#dcfce7', '#fef9c3', '#fce7f3', '#ede9fe'];
	const STACK_STROKES = ['#2563eb', '#16a34a', '#ca8a04', '#db2777', '#7c3aed'];

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
		colorIdx?: number;
	}

	// Normalize to array — either explicit items or the single dims prop
	let tabletItems = $derived.by((): Array<{ dims: Dimensions; label: string }> => {
		if (items && items.length > 0)
			return items.filter(i => i.dims.Width != null && i.dims.Height != null);
		if (dims && dims.Width != null && dims.Height != null)
			return [{ dims, label: 'Active Area' }];
		return [];
	});

	let aSeries = $derived(
		isoSizes
			.filter(p => p.Series === 'A')
			.sort((a, b) => (b.Width_mm * b.Height_mm) - (a.Width_mm * a.Height_mm))
	);

	// Use the largest tablet as the reference for selecting the ISO range
	let referenceDims = $derived.by((): Dimensions | undefined => {
		if (tabletItems.length === 0) return undefined;
		return tabletItems.reduce((best, cur) => {
			const a = (cur.dims.Width ?? 0) * (cur.dims.Height ?? 0);
			const b = (best.dims.Width ?? 0) * (best.dims.Height ?? 0);
			return a > b ? cur : best;
		}, tabletItems[0]).dims;
	});

	// Find closest A size index by area
	let closestISOIdx = $derived.by(() => {
		if (!referenceDims || referenceDims.Width == null || referenceDims.Height == null || aSeries.length === 0) return -1;
		const refArea = referenceDims.Width * referenceDims.Height;
		let best = 0, bestDist = Infinity;
		aSeries.forEach((p, i) => {
			const d = Math.abs(p.Width_mm * p.Height_mm - refArea);
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
		if (tabletItems.length === 0) return [];
		const isoItems: ChartItem[] = (showISO ? isoSlice : []).map(p => ({
			label: p.Name,
			dimsLabel: `${p.Width_mm}×${p.Height_mm}`,
			wMm: Math.max(p.Width_mm, p.Height_mm),
			hMm: Math.min(p.Width_mm, p.Height_mm),
			isTablet: false,
		}));
		const tabItems: ChartItem[] = tabletItems.map(({ dims: d, label }) => {
			const dw = d.Width!;
			const dh = d.Height!;
			return {
				label,
				dimsLabel: `${dw}×${dh}`,
				wMm: Math.max(dw, dh),
				hMm: Math.min(dw, dh),
				isTablet: true,
			};
		});
		return [...isoItems, ...tabItems].sort((a, b) => (b.wMm * b.hMm) - (a.wMm * a.hMm));
	});

	let layout = $derived.by((): { rects: ChartRect[]; svgW: number } | null => {
		if (chartItems.length === 0) return null;
		const maxH = Math.max(...chartItems.map(it => it.hMm));
		const scale = CHART_H / maxH;

		if (stacked) {
			// Sort largest-first so smallest renders on top
			const sorted = [...chartItems].sort((a, b) => (b.wMm * b.hMm) - (a.wMm * a.hMm));
			const maxW = Math.max(...sorted.map(it => it.wMm));
			const svgW = Math.round(maxW * scale);
			const centerX = svgW / 2;
			const rects: ChartRect[] = sorted.map((it, i) => {
				const sw = Math.round(it.wMm * scale);
				const sh = Math.round(it.hMm * scale);
				const x = centerX - sw / 2;
				return { x, sw, sh, isTablet: it.isTablet, label: it.label, dimsLabel: it.dimsLabel, colorIdx: i };
			});
			return { rects, svgW };
		}

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
			aria-label="Active area size comparison"
		>
			<g transform="translate(0,{PAD_TOP})">
				{#each layout.rects as r}
					{#if stacked && r.colorIdx != null}
						<rect
							x={r.x}
							y={CHART_H - r.sh}
							width={r.sw}
							height={r.sh}
							fill={STACK_FILLS[r.colorIdx % STACK_FILLS.length]}
							stroke={STACK_STROKES[r.colorIdx % STACK_STROKES.length]}
							stroke-width="1.5"
							fill-opacity="0.75"
						/>
						<text
							x={r.x + r.sw / 2}
							y={CHART_H - r.sh - 6}
							text-anchor="middle"
							font-size="11"
							font-weight="700"
							fill={STACK_STROKES[r.colorIdx % STACK_STROKES.length]}
							font-family="inherit"
						>{r.label}</text>
					{:else}
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
					{/if}
				{/each}
				<line x1="0" y1={CHART_H} x2={layout.svgW} y2={CHART_H} class="baseline" />
			</g>
		</svg>
	</div>
	{#if stacked && layout.rects.length > 0}
		<div class="stack-legend">
			{#each layout.rects as r}
				{#if r.colorIdx != null}
					<div class="legend-item">
						<span class="legend-swatch" style="background:{STACK_FILLS[r.colorIdx % STACK_FILLS.length]};border-color:{STACK_STROKES[r.colorIdx % STACK_STROKES.length]}"></span>
						<span class="legend-label">{r.label}</span>
						<span class="legend-dims">{r.dimsLabel} mm</span>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
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

	.stack-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
	}

	.legend-swatch {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		border: 1.5px solid;
		flex-shrink: 0;
	}

	.legend-label {
		font-weight: 600;
		color: var(--text);
	}

	.legend-dims {
		color: var(--text-muted);
	}
</style>
