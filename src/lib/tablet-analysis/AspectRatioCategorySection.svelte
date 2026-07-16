<script lang="ts">
	import AnalysisExportRow from '$lib/tablet-analysis/AnalysisExportRow.svelte';
	import MeterBar from '$lib/components/MeterBar.svelte';

	type Row = { label: string; count: number };

	let {
		title,
		description,
		rows,
		onExport,
	}: {
		title: string;
		description?: string;
		rows: Row[];
		onExport: () => void;
	} = $props();

	let total = $derived(rows.reduce((s, r) => s + r.count, 0));
</script>

<h2>{title}</h2>
{#if description}
	<p class="description">{description}</p>
{/if}
<AnalysisExportRow disabled={rows.length === 0} onclick={onExport} />
<table class="stat-table">
	<thead><tr><th>Category</th><th>Count</th><th></th></tr></thead>
	<tbody>
		{#each rows as row (row.label)}
			{@const pctVal = total === 0 ? '0.0' : ((row.count / total) * 100).toFixed(1)}
			<tr>
				<td class="label mono">{row.label}</td>
				<td class="count">{row.count}</td>
				<td class="bar-cell">
					<MeterBar pct={Number(pctVal)} />
					<span class="pct">{pctVal}%</span>
				</td>
			</tr>
		{/each}
	</tbody>
</table>
