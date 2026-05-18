<script lang="ts">
	import ValueHistogram, { type HistogramMarker } from '$lib/components/ValueHistogram.svelte';
	import type { SpecBand } from '$lib/bands.js';
	import type { Tablet } from '$data/lib/drawtab-loader.js';
	import { subtitleFor } from '$lib/tablet-analysis/helpers.js';

	type Overlay = 'none' | 'iso-a' | 'iso-b' | 'us';
	const OVERLAY_OPTIONS: { value: Overlay; label: string }[] = [
		{ value: 'none', label: 'None' },
		{ value: 'iso-a', label: 'ISO A paper sizes' },
		{ value: 'iso-b', label: 'ISO B paper sizes' },
		{ value: 'us', label: 'US paper sizes' },
	];

	let {
		title,
		description,
		histogramTitle,
		tablets,
		values,
		ranges,
		unit,
		binSize,
		overlay = $bindable(),
		compareYears = $bindable(),
		markers,
	}: {
		title: string;
		description: string;
		histogramTitle: string;
		tablets: Tablet[];
		values: number[];
		ranges: SpecBand[];
		unit: string;
		binSize: number;
		overlay: Overlay;
		compareYears: number | null;
		markers: HistogramMarker[];
	} = $props();
</script>

<div class="section-header">
	<h2>{title} ({values.length})</h2>
	<label class="overlay-select">
		Overlay:
		<select bind:value={overlay}>
			{#each OVERLAY_OPTIONS as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</label>
</div>
<p class="description">{description}</p>
{#if values.length > 0}
	<ValueHistogram
		title={histogramTitle}
		subtitle={subtitleFor(tablets)}
		{values}
		currentValue={null}
		{ranges}
		{unit}
		{binSize}
		bandwidthMultiplier={0.2}
		bind:compareYears
		compareYearOptions={[5, 10, 15, 20, null]}
		{markers}
		showUnitInTitle
		showUnitInBands={false}
		showUnitInAxis={false}
	/>
{/if}

<style>
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 8px;
	}
	.section-header h2 {
		margin: 0;
	}

	.overlay-select {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.overlay-select select {
		font-size: 12px;
		padding: 3px 8px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}
</style>
