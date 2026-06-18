<script lang="ts">
	// Shared chart chrome (GitHub #230), the sibling of TableFrame (#229). Owns
	// the chrome around a chart body: optional title/subtitle, a left-aligned
	// controls area (view/zoom/compare selectors), a right-aligned actions area
	// (export), and an optional footer/legend slot below the chart. The chart
	// body itself stays a snippet/child — PressureChart, BandsChart,
	// ValueHistogram, etc. remain specialized (the #228 ruling: frames
	// standardize chrome via slots, not a universal chart API).
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		controls,
		actions,
		footer,
		children,
	}: {
		title?: string;
		subtitle?: string;
		/** Chart controls (view/zoom/compare selectors), left-aligned. */
		controls?: Snippet;
		/** Chart-level actions (export), right-aligned. */
		actions?: Snippet;
		/** Optional legend/companion content rendered below the chart. */
		footer?: Snippet;
		children: Snippet;
	} = $props();

	let hasHeader = $derived(Boolean(title || subtitle || controls || actions));
</script>

<div class="chart-frame">
	{#if hasHeader}
		<div class="cf-header">
			{#if title}<h3 class="cf-title">{title}</h3>{/if}
			{#if subtitle}<span class="cf-subtitle">{subtitle}</span>{/if}
			{#if controls}<div class="cf-controls">{@render controls()}</div>{/if}
			{#if actions}<div class="cf-actions">{@render actions()}</div>{/if}
		</div>
	{/if}

	{@render children()}

	{#if footer}<div class="cf-footer">{@render footer()}</div>{/if}
</div>

<style>
	.cf-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 4px;
	}

	.cf-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #6b21a8;
	}

	.cf-subtitle {
		font-size: 12px;
		color: var(--text-muted);
	}

	.cf-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* Push actions (export) to the right edge of the chart chrome. */
	.cf-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.cf-footer {
		margin-top: 8px;
	}
</style>
