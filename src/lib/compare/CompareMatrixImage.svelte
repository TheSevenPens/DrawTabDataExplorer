<script lang="ts">
	// The Compare matrix drawn as SVG for image export (#378). Rendered off
	// screen — never shown — so the chart exporter can read its computed
	// colours and fonts (flattenComputedStyles needs a laid-out node) and
	// produce PNG / SVG / PowerPoint that match the current theme.
	import { svgTextStyle } from '$lib/chart-type.js';
	import type { MatrixImageLayout, Tone } from './matrix-image';

	let { layout, svg = $bindable() }: { layout: MatrixImageLayout; svg?: SVGSVGElement } = $props();

	const TONE: Record<Tone, string> = {
		text: 'var(--text)',
		muted: 'var(--text-muted)',
		dim: 'var(--text-dim)',
	};
</script>

<div class="offscreen" aria-hidden="true">
	<svg
		bind:this={svg}
		xmlns="http://www.w3.org/2000/svg"
		width={layout.width}
		height={layout.height}
		viewBox="0 0 {layout.width} {layout.height}"
	>
		<rect x="0" y="0" width={layout.width} height={layout.height} fill="var(--bg)" />
		{#each layout.rects as r, i (i)}
			<rect
				x={r.x}
				y={r.y}
				width={r.w}
				height={r.h}
				fill={r.kind === 'wash' ? 'var(--accent-wash)' : (r.color ?? 'var(--text-dim)')}
			/>
		{/each}
		{#each layout.rules as l, i (i)}
			<line
				x1={l.x1}
				y1={l.y1}
				x2={l.x2}
				y2={l.y2}
				stroke={l.strong ? 'var(--border)' : 'var(--border-light)'}
				stroke-width="1"
			/>
		{/each}
		{#each layout.texts as t, i (i)}
			<text x={t.x} y={t.y} text-anchor={t.anchor} style={svgTextStyle(t.role)} fill={TONE[t.tone]}
				>{t.text}</text
			>
		{/each}
	</svg>
</div>

<style>
	/* Laid out (so computed styles and sizes exist) but out of view. */
	.offscreen {
		position: absolute;
		left: -100000px;
		top: 0;
		pointer-events: none;
	}
</style>
