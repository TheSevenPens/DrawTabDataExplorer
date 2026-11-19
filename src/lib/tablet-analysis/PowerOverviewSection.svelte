<script lang="ts">
	import DistributionTable from '$lib/components/DistributionTable.svelte';
	import SectionHeader from '$lib/components/SectionHeader.svelte';
	import AnalysisExportRow from '$lib/tablet-analysis/AnalysisExportRow.svelte';
	import { pct } from '$lib/tablet-analysis/helpers.js';
	import type { PowerCoverageRow } from '$lib/power.js';

	type Row = { label: string; count: number };

	let {
		coverage,
		penTabletCount,
		penDisplayCount,
		penTabletSources,
		penDisplaySources,
		standaloneWithPower,
		standaloneCount,
		onExport,
	}: {
		coverage: PowerCoverageRow[];
		penTabletCount: number;
		penDisplayCount: number;
		penTabletSources: Row[];
		penDisplaySources: Row[];
		standaloneWithPower: number;
		standaloneCount: number;
		onExport: () => void;
	} = $props();

	function cell(n: number, of: number): string {
		return `${n} of ${of} (${pct(n, of)})`;
	}
</script>

<h2>Power Overview</h2>
<p class="description">
	Power specs as the manufacturer states them. Two kinds of number are kept apart throughout: the
	<strong>input rating</strong> is what the tablet's power input accepts (e.g. 19 V 3.42 A, a 65 W
	ceiling the supply must meet), while <strong>consumption</strong> is what the tablet actually draws.
	A tablet's rating is usually well above its draw, so the two are never compared as one number.
</p>
<p class="description">
	Coverage is partial: a blank below means the spec wasn't published or hasn't been recorded, not
	zero. Standalones are left out of the Power sections ({standaloneWithPower} of {standaloneCount}
	record any power data).
</p>

<AnalysisExportRow onclick={onExport} />
<table class="rank-table">
	<thead>
		<tr>
			<th>Field</th>
			<th>Kind</th>
			<th class="num">Pen tablets</th>
			<th class="num">Pen displays</th>
		</tr>
	</thead>
	<tbody>
		{#each coverage as row (row.label)}
			<tr>
				<td>{row.label}</td>
				<td class="dim">{row.kind === 'Any' ? '' : row.kind}</td>
				<td class="num">{cell(row.penTablets, penTabletCount)}</td>
				<td class="num">{cell(row.penDisplays, penDisplayCount)}</td>
			</tr>
		{/each}
	</tbody>
</table>

<SectionHeader title="Input source" />
<p class="description">
	How the tablet's main input is powered: from its own power adapter, from the computer's USB-C
	Power Delivery port, or from a plain USB port.
</p>
<div class="source-tables">
	<div>
		<h3>Pen tablets ({penTabletCount})</h3>
		<DistributionTable labelHeader="Input source" rows={penTabletSources} total={penTabletCount} />
	</div>
	<div>
		<h3>Pen displays ({penDisplayCount})</h3>
		<DistributionTable
			labelHeader="Input source"
			rows={penDisplaySources}
			total={penDisplayCount}
		/>
	</div>
</div>

<style>
	.dim {
		color: var(--text-dim);
	}
	h3 {
		font-size: var(--type-body);
		font-weight: 600;
		color: var(--text-muted);
		margin: 8px 0 4px;
	}
	.source-tables {
		display: flex;
		flex-wrap: wrap;
		gap: 32px;
	}
</style>
