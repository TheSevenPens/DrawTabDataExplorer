<script lang="ts">
	import ValueHistogram from '$lib/components/ValueHistogram.svelte';
	import DistributionTable from '$lib/components/DistributionTable.svelte';
	import AnalysisExportRow from '$lib/tablet-analysis/AnalysisExportRow.svelte';
	import type { Band } from '$lib/bands.js';
	import { bandsToHistogramRanges, pressureSubtitle } from '$lib/pen-analysis/helpers.js';
	import { fmtP } from '$data/lib/pressure/interpolate.js';

	export type MetricRow = {
		/** Estimated metric value (P00 or P100) in gf. */
		value: number;
		/** Pen-model EntityId for the session. */
		penEntityId: string;
		/** Inventory-pen ID. */
		inventoryId: string;
	};

	let {
		title,
		description,
		bands,
		axisMax,
		binSize,
		tickStep,
		rows,
		onExport,
	}: {
		/** Section heading, e.g. "IAF (P00) Distribution". */
		title: string;
		description: string;
		bands: Band[];
		axisMax: number;
		binSize: number;
		tickStep?: number;
		rows: MetricRow[];
		onExport: () => void;
	} = $props();

	let values = $derived(rows.map((r) => Math.min(r.value, axisMax)));
	let ranges = $derived(bandsToHistogramRanges(bands, axisMax));

	let modelCount = $derived(new Set(rows.map((r) => r.penEntityId)).size);
	let unitCount = $derived(new Set(rows.map((r) => r.inventoryId)).size);
	let subtitle = $derived(
		rows.length > 0 ? pressureSubtitle(modelCount, unitCount, rows.length) : '',
	);

	// Tally by band, ascending by band lower bound for natural reading.
	let bandRows = $derived.by(() => {
		const counts = ranges.map((r) => ({ label: r.label, count: 0 }));
		for (const v of values) {
			const idx = ranges.findIndex((r, i) =>
				i === ranges.length - 1 ? v >= r.min && v <= r.max : v >= r.min && v < r.max,
			);
			if (idx >= 0) counts[idx].count += 1;
		}
		return counts;
	});

	let bandStats = $derived.by(() => {
		const xs = [...rows.map((r) => r.value)].sort((a, b) => a - b);
		if (xs.length === 0) return null;
		const min = xs[0];
		const max = xs[xs.length - 1];
		const mid = Math.floor(xs.length / 2);
		const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
		return { min, median, max };
	});
</script>

<h2>{title}</h2>
<p class="description">{description}</p>

{#if rows.length > 0 && bandStats}
	<ValueHistogram
		{title}
		{subtitle}
		{values}
		currentValue={null}
		{ranges}
		unit="gf"
		{binSize}
		{tickStep}
		showUnitInTitle
		showUnitInBands={false}
		showUnitInAxis={false}
	/>
	<table class="metric-summary-table">
		<tbody>
			<tr>
				<th>Min <span class="unit">(gf)</span></th>
				<td class="mono">{fmtP(bandStats.min)}</td>
			</tr>
			<tr>
				<th>Median <span class="unit">(gf)</span></th>
				<td class="mono">{fmtP(bandStats.median)}</td>
			</tr>
			<tr>
				<th>Max <span class="unit">(gf)</span></th>
				<td class="mono">{fmtP(bandStats.max)}</td>
			</tr>
		</tbody>
	</table>
	<AnalysisExportRow onclick={onExport} />
	<DistributionTable labelHeader="Band" rows={bandRows} total={rows.length} />
{:else}
	<p class="no-data">No measurements available.</p>
{/if}

<style>
	.description {
		font-size: 13px;
		color: var(--text-dim);
		margin-bottom: 8px;
	}
	.no-data {
		font-size: 13px;
		color: var(--text-muted);
		font-style: italic;
	}

	.metric-summary-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 12px 0;
		width: fit-content;
	}
	.metric-summary-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.metric-summary-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.metric-summary-table td {
		padding: 6px 14px;
		font-variant-numeric: tabular-nums;
	}
	.metric-summary-table tr {
		border-bottom: 1px solid var(--border);
	}
	.metric-summary-table tr:last-child {
		border-bottom: none;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
</style>
