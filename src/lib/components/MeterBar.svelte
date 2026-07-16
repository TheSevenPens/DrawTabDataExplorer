<script lang="ts">
	// A single-series magnitude bar — a filled proportion of a track. Used by
	// the distribution tables (DistributionTable, the aspect-ratio sections)
	// and the data-quality completion table, which each hand-rolled it
	// slightly differently. The fill is the accent, same as the histogram
	// bars (see CLAUDE.md § Chart colours); square, per Metro.
	let { pct }: { pct: number } = $props();
	let clamped = $derived(Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0)));
</script>

<div class="bar-bg"><div class="bar-fill" style="width:{clamped}%"></div></div>

<style>
	.bar-bg {
		width: 120px;
		height: 12px;
		background: var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		flex-shrink: 0;
	}
	.bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: var(--radius);
	}
</style>
