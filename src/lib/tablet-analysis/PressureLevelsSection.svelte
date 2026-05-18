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

<h2>Pressure Levels</h2>
<p class="description">{total} of {coveredOf} tablets have pressure level data.</p>
<AnalysisExportRow disabled={rows.length === 0} onclick={onExport} />
<DistributionTable
	labelHeader="Pressure Levels"
	{rows}
	{total}
	formatLabel={(l) => Number(l).toLocaleString()}
/>
