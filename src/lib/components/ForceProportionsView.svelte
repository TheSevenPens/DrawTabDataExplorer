<script lang="ts">
	import { POPULAR_RATIOS, VERYCLOSE_THRESHOLD } from '$data/lib/aspect-ratio.js';
	import { unitPreference } from '$lib/unit-store.js';

	let { width, height }: { width: number; height: number } = $props();

	const TARGETS = [
		{ label: '16:9', ratio: 16 / 9 },
		{ label: '16:10', ratio: 16 / 10 },
	];

	const PANEL_MAX = 180;
	const EPS = 0.0005;

	type Calc = {
		label: string;
		ratio: number;
		usedW: number;
		usedH: number;
		usedFraction: number;
		lostFraction: number;
		strip: 'horizontal' | 'vertical' | 'none';
		drawnW: number;
		drawnH: number;
		usedDrawnW: number;
		usedDrawnH: number;
		targetDrawnW: number;
		targetDrawnH: number;
	};

	function compute(t: { label: string; ratio: number }): Calc {
		const r_t = width / height;
		const r = t.ratio;
		let usedW: number;
		let usedH: number;
		let strip: 'horizontal' | 'vertical' | 'none';
		if (Math.abs(r_t - r) < EPS) {
			usedW = width; usedH = height; strip = 'none';
		} else if (r_t < r) {
			// tablet narrower than target → fit width, lose height (strip at bottom)
			usedW = width; usedH = width / r; strip = 'horizontal';
		} else {
			// tablet wider than target → fit height, lose width (strip at right)
			usedW = height * r; usedH = height; strip = 'vertical';
		}

		const usedFraction = (usedW * usedH) / (width * height);

		const tabletScale = PANEL_MAX / Math.max(width, height);
		const drawnW = width * tabletScale;
		const drawnH = height * tabletScale;
		const usedDrawnW = usedW * tabletScale;
		const usedDrawnH = usedH * tabletScale;

		const targetScale = PANEL_MAX / Math.max(r, 1);
		const targetDrawnW = r * targetScale;
		const targetDrawnH = 1 * targetScale;

		return {
			label: t.label,
			ratio: r,
			usedW,
			usedH,
			usedFraction,
			lostFraction: 1 - usedFraction,
			strip,
			drawnW,
			drawnH,
			usedDrawnW,
			usedDrawnH,
			targetDrawnW,
			targetDrawnH,
		};
	}

	let calcs = $derived(width > 0 && height > 0 ? TARGETS.map(compute) : []);

	function fmtLen(mm: number): string {
		if ($unitPreference === 'imperial') {
			return (mm * 0.03937).toFixed(2);
		}
		return mm.toFixed(1);
	}

	let lenUnit = $derived($unitPreference === 'imperial' ? 'in' : 'mm');
	let areaUnit = $derived($unitPreference === 'imperial' ? 'sq in' : 'sq cm');

	function fmtPct(n: number): string {
		return (n * 100).toFixed(1);
	}

	function diag(w: number, h: number): number {
		return Math.sqrt(w * w + h * h);
	}

	function fmtArea(wMm: number, hMm: number): string {
		if ($unitPreference === 'imperial') {
			const wIn = wMm * 0.03937;
			const hIn = hMm * 0.03937;
			return (wIn * hIn).toFixed(2);
		}
		return ((wMm * hMm) / 100).toFixed(1);
	}

	function fmtAreaDelta(deltaMm2: number): string {
		if ($unitPreference === 'imperial') {
			// mm² → in² via (0.03937)² ≈ 0.00155
			return (deltaMm2 * 0.03937 * 0.03937).toFixed(2);
		}
		return (deltaMm2 / 100).toFixed(1);
	}

	function tabletRatioLabel(): string {
		if (width <= 0 || height <= 0) return '';
		// Normalize to long/short so portrait panels label the same as landscape.
		const r = Math.max(width, height) / Math.min(width, height);
		for (const p of POPULAR_RATIOS) {
			if (Math.abs(r - p.ratio) <= VERYCLOSE_THRESHOLD) {
				return p.name.replace('X', ':');
			}
		}
		return `${r.toFixed(2)}:1`;
	}
</script>

{#if calcs.length === 0}
	<p class="no-data">Active area dimensions are missing for this tablet.</p>
{:else}
	<div class="intro">
		<p>
			"Force Proportions" is a driver setting that scales the X and Y axes by the same
			factor so a circle drawn on the tablet renders as a circle on screen. To do that,
			the driver must crop the tablet's active area to match the display's aspect ratio.
			Below, we show the loss against the two most common monitor ratios.
		</p>
	</div>
	{#each calcs as c}
		<div class="row">
			<h3>Force Proportions to {c.label}</h3>
			<div class="diagram">
				<!-- Panel 1: Tablet at its actual ratio -->
				<div class="panel">
					<svg viewBox="0 0 {PANEL_MAX} {PANEL_MAX}" width={PANEL_MAX} height={PANEL_MAX}>
						<rect
							x={(PANEL_MAX - c.drawnW) / 2}
							y={(PANEL_MAX - c.drawnH) / 2}
							width={c.drawnW}
							height={c.drawnH}
							fill="#5bc0eb"
							stroke="#1a374d"
							stroke-width="2"
						/>
						<text
							x={PANEL_MAX / 2}
							y={PANEL_MAX / 2 + 5}
							text-anchor="middle"
							fill="white"
							font-size="14"
							font-weight="600"
						>
							{tabletRatioLabel()}
						</text>
					</svg>
					<div class="caption">
						{fmtLen(width)} × {fmtLen(height)} {lenUnit}<br />
						{fmtLen(diag(width, height))} {lenUnit} diagonal<br />
						{fmtArea(width, height)} {areaUnit}
					</div>
				</div>

				<div class="arrow">
					<span>Force to</span>
					<svg width="44" height="14" aria-hidden="true">
						<path d="M 0 7 L 38 7 M 32 2 L 38 7 L 32 12" stroke="#1a374d" stroke-width="2" fill="none" />
					</svg>
				</div>

				<!-- Panel 2: Target ratio -->
				<div class="panel">
					<svg viewBox="0 0 {PANEL_MAX} {PANEL_MAX}" width={PANEL_MAX} height={PANEL_MAX}>
						<rect
							x={(PANEL_MAX - c.targetDrawnW) / 2}
							y={(PANEL_MAX - c.targetDrawnH) / 2}
							width={c.targetDrawnW}
							height={c.targetDrawnH}
							fill="#d9601a"
							stroke="#1a374d"
							stroke-width="2"
						/>
						<text
							x={PANEL_MAX / 2}
							y={PANEL_MAX / 2 + 5}
							text-anchor="middle"
							fill="white"
							font-size="14"
							font-weight="600"
						>
							{c.label}
						</text>
					</svg>
					<div class="caption">monitor aspect ratio</div>
				</div>

				<div class="arrow">
					<svg width="44" height="14" aria-hidden="true">
						<path d="M 0 7 L 38 7 M 32 2 L 38 7 L 32 12" stroke="#1a374d" stroke-width="2" fill="none" />
					</svg>
				</div>

				<!-- Panel 3: Result -->
				<div class="panel">
					<svg viewBox="0 0 {PANEL_MAX} {PANEL_MAX}" width={PANEL_MAX} height={PANEL_MAX}>
						{#if c.strip === 'none'}
							<rect
								x={(PANEL_MAX - c.drawnW) / 2}
								y={(PANEL_MAX - c.drawnH) / 2}
								width={c.drawnW}
								height={c.drawnH}
								fill="#5bc0eb"
								stroke="#1a374d"
								stroke-width="2"
							/>
						{:else if c.strip === 'horizontal'}
							<!-- USED at top, LOST strip at bottom -->
							<rect
								x={(PANEL_MAX - c.drawnW) / 2}
								y={(PANEL_MAX - c.drawnH) / 2}
								width={c.usedDrawnW}
								height={c.usedDrawnH}
								fill="#5bc0eb"
							/>
							<rect
								x={(PANEL_MAX - c.drawnW) / 2}
								y={(PANEL_MAX - c.drawnH) / 2 + c.usedDrawnH}
								width={c.drawnW}
								height={c.drawnH - c.usedDrawnH}
								fill="#bfe5f5"
							/>
							<rect
								x={(PANEL_MAX - c.drawnW) / 2}
								y={(PANEL_MAX - c.drawnH) / 2}
								width={c.drawnW}
								height={c.drawnH}
								fill="none"
								stroke="#1a374d"
								stroke-width="2"
							/>
						{:else}
							<!-- USED at left, LOST strip at right -->
							<rect
								x={(PANEL_MAX - c.drawnW) / 2}
								y={(PANEL_MAX - c.drawnH) / 2}
								width={c.usedDrawnW}
								height={c.usedDrawnH}
								fill="#5bc0eb"
							/>
							<rect
								x={(PANEL_MAX - c.drawnW) / 2 + c.usedDrawnW}
								y={(PANEL_MAX - c.drawnH) / 2}
								width={c.drawnW - c.usedDrawnW}
								height={c.drawnH}
								fill="#bfe5f5"
							/>
							<rect
								x={(PANEL_MAX - c.drawnW) / 2}
								y={(PANEL_MAX - c.drawnH) / 2}
								width={c.drawnW}
								height={c.drawnH}
								fill="none"
								stroke="#1a374d"
								stroke-width="2"
							/>
						{/if}
					</svg>
					<div class="legend">
						<div><span class="swatch used"></span> USED: {fmtPct(c.usedFraction)}%</div>
						<div><span class="swatch lost"></span> LOST: {fmtPct(c.lostFraction)}%</div>
					</div>
					<div class="caption">
						{fmtLen(c.usedW)} × {fmtLen(c.usedH)} {lenUnit} usable<br />
						{fmtLen(diag(c.usedW, c.usedH))} {lenUnit} diagonal{#if c.strip !== 'none'}{' '}<span class="delta">({fmtLen(diag(c.usedW, c.usedH) - diag(width, height))} {lenUnit})</span>{/if}<br />
						{fmtArea(c.usedW, c.usedH)} {areaUnit}{#if c.strip !== 'none'}{' '}<span class="delta">({fmtAreaDelta(c.usedW * c.usedH - width * height)} {areaUnit})</span>{/if}
					</div>
				</div>
			</div>
		</div>
	{/each}
{/if}

<style>
	.intro {
		max-width: 720px;
		margin-bottom: 20px;
		font-size: 13px;
		color: var(--text-muted);
		line-height: 1.5;
	}
	.intro p {
		margin: 0;
	}
	.row {
		margin-bottom: 28px;
	}
	h3 {
		font-size: 14px;
		margin: 0 0 10px 0;
		color: var(--text);
		font-weight: 600;
	}
	.diagram {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		flex-wrap: wrap;
	}
	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.panel :global(svg) {
		display: block;
	}
	.caption {
		margin-top: 6px;
		font-size: 12px;
		color: var(--text-muted);
		text-align: left;
		align-self: flex-start;
	}
	.delta {
		color: #b91c1c;
	}
	.arrow {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding-top: 78px;
		color: var(--text-muted);
		font-size: 12px;
	}
	.legend {
		margin-top: 6px;
		font-size: 12px;
		color: var(--text);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 4px;
		vertical-align: middle;
		border: 1px solid #1a374d;
	}
	.swatch.used { background: #5bc0eb; }
	.swatch.lost { background: #bfe5f5; }
	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}
</style>
