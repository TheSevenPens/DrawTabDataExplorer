<script lang="ts">
	import DistributionTable from '$lib/components/DistributionTable.svelte';
	import ValueHistogram from '$lib/components/ValueHistogram.svelte';
	import AnalysisExportRow from '$lib/tablet-analysis/AnalysisExportRow.svelte';
	import { subtitleFor } from '$lib/tablet-analysis/helpers.js';
	import type { NumericSection } from '$lib/tablet-analysis/numeric-sections.js';

	let {
		section,
		compareYears = $bindable(),
		onExport,
	}: {
		section: NumericSection;
		compareYears: number | null;
		onExport: () => void;
	} = $props();
</script>

<h2>{section.title}</h2>
<p class="description">
	{section.data.count} of {section.pool}
	{section.poolLabel} have {section.title.toLowerCase()}
	data.
</p>
{#if section.histogram && section.histogram.values.length > 0}
	<ValueHistogram
		title={`${section.title} distribution`}
		subtitle={subtitleFor(section.data.tablets)}
		values={section.histogram.values}
		currentValue={null}
		ranges={section.histogram.ranges}
		unit={section.histogram.unit}
		binSize={section.histogram.binSize}
		tickStep={section.histogram.tickStep}
		showUnitInTitle={section.histogram.showUnitInTitle ?? false}
		showUnitInBands={section.histogram.showUnitInBands ?? true}
		showUnitInAxis={section.histogram.showUnitInAxis ?? true}
		bind:compareYears
		compareYearOptions={[5, 10, 15, 20, null]}
	/>
	{#if section.histogram.note}
		<p class="description histogram-note">{section.histogram.note}</p>
	{/if}
{/if}
{#if section.data.rows.length > 0}
	<AnalysisExportRow onclick={onExport} />
	<DistributionTable
		labelHeader={`${section.title} (${section.unit})`}
		rows={section.data.rows}
		total={section.data.count}
		formatLabel={(l) => Number(l).toLocaleString()}
	/>
{/if}
