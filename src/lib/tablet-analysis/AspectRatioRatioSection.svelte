<script lang="ts">
	import AnalysisExportRow from '$lib/tablet-analysis/AnalysisExportRow.svelte';

	type Row = { label: string; count: number; ratio16: string; decimal: string; category: string };

	let {
		title,
		rows,
		onExport,
	}: {
		title: string;
		rows: Row[];
		onExport: () => void;
	} = $props();

	let total = $derived(rows.reduce((s, r) => s + r.count, 0));
</script>

<h2>{title}</h2>
<AnalysisExportRow disabled={rows.length === 0} onclick={onExport} />
<table class="stat-table">
	<thead>
		<tr><th>Ratio</th><th>Decimal</th><th>Category</th><th>Count</th><th></th></tr>
	</thead>
	<tbody>
		{#each rows as row (row.ratio16 + row.category)}
			{@const pctVal = total === 0 ? '0.0' : ((row.count / total) * 100).toFixed(1)}
			<tr>
				<td class="decimal">{row.ratio16}</td>
				<td class="decimal">{row.decimal}</td>
				<td class="mono">{row.category}</td>
				<td class="count">{row.count}</td>
				<td class="bar-cell">
					<div class="bar-bg"><div class="bar-fill" style="width:{pctVal}%"></div></div>
					<span class="pct">{pctVal}%</span>
				</td>
			</tr>
		{/each}
	</tbody>
</table>
