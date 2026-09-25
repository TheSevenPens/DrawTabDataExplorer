<script lang="ts">
	// All comparison columns' IAF or MAX readings on one chart, one row per
	// column so the bands never collide. Each row: the column's min–max stripe,
	// a thin tick per pen unit, a heavy median — in the column's colour, under
	// its name. The chart grows a row at a time. Values follow the same
	// per-unit rule as the per-column PressureRangeTab sections below it.
	import type { Pen, PressureResponse, PressureRange } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import PressureBandsChart from '$lib/components/PressureBandsChart.svelte';
	import { PIAF_BANDS, PMAX_BANDS } from '$lib/bands.js';
	import {
		columnMeasurements,
		median,
		columnRangeValues,
		columnSessions,
		rangeRowsChart,
		type RangeRow,
	} from './pen-groups';
	import type { ResolvedColumn } from './resolve';

	let {
		metric,
		columns,
		colors,
		sessions,
		measurements,
		defectsByInventoryId,
	}: {
		metric: 'IAF' | 'MAX';
		columns: ResolvedColumn<Pen>[];
		colors: string[];
		sessions: PressureResponse[];
		/** This metric's direct measurements. */
		measurements: PressureRange[];
		defectsByInventoryId: ReadonlyMap<string, DefectInfo>;
	} = $props();

	// Same axes as PressureRangeTab: IAF runs to 22 gf (values clamp), MAX to 1000.
	let axisMax = $derived(metric === 'IAF' ? 22 : 1000);
	let axisStep = $derived(metric === 'IAF' ? 1 : 100);

	let rows: RangeRow[] = $derived(
		columns.map((col, i) => {
			const values = columnRangeValues(
				metric,
				columnSessions(col, sessions),
				columnMeasurements(col, measurements),
				defectsByInventoryId,
			);
			return { label: col.name, color: colors[i], values, median: median(values) };
		}),
	);
	let chart = $derived(rangeRowsChart(rows, axisMax));
	let unitCount = $derived(rows.reduce((n, r) => n + r.values.length, 0));
</script>

<section class="combined">
	<PressureBandsChart
		bands={metric === 'IAF' ? PIAF_BANDS : PMAX_BANDS}
		{axisMax}
		{axisStep}
		unit="gf"
		showUnitInAxis={metric !== 'IAF'}
		heading="{metric} by column"
		subtitle="one row per column · range across pen units, a tick per unit, heavy line = median · {unitCount} units"
		title="compare-{metric.toLowerCase()}-by-column"
		shadedRanges={chart.shadedRanges}
		markers={chart.markers}
		rowHeight={44}
	/>
</section>

<style>
	.combined {
		margin-bottom: 28px;
	}
</style>
