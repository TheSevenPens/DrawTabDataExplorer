<script lang="ts">
	import DistributionTable from '$lib/components/DistributionTable.svelte';
	import AnalysisExportRow from '$lib/tablet-analysis/AnalysisExportRow.svelte';

	type Row = { label: string; count: number };

	let {
		rows,
		total,
		coveredOf,
		onExport,
	}: {
		rows: Row[];
		total: number;
		coveredOf: number;
		onExport: () => void;
	} = $props();
</script>

<h2>Touch Support</h2>
<p class="description">Distribution of {coveredOf} tablets by digitizer touch support.</p>
<AnalysisExportRow disabled={rows.length === 0} onclick={onExport} />
<DistributionTable labelHeader="Touch" {rows} {total} />
