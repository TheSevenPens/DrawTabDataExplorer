<script lang="ts">
	import BandsChart, { type BandMarker } from '$lib/components/BandsChart.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import { MAX_PRESSURE_BANDS } from '$lib/bands.js';
	import type { PressureResponse } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import { estimateP100, fmtP } from '$data/lib/pressure/interpolate.js';

	// Sessions passed to the embedded max-zoom PressureChart. The parent
	// computes these alongside the other pressure tabs to keep colors and
	// hidden-state in sync across tabs.
	interface ChartSession {
		id: string;
		label: string;
		records: PressureResponse['Records'];
		color: string | undefined;
		defective: boolean;
		defectInfo?: string;
	}

	let {
		pressureSessions,
		defectsByInventoryId,
		chartSessions,
		hiddenIds,
		displayName,
		chartTitlePrefix,
		entityLabel,
	}: {
		pressureSessions: PressureResponse[];
		defectsByInventoryId: ReadonlyMap<string, DefectInfo>;
		chartSessions: ChartSession[];
		hiddenIds: ReadonlySet<string>;
		/** Used in BandsChart `heading` overlays, e.g. "Wacom Pro Pen" or
		 * "WacomKPGen1". */
		displayName: string;
		/** Used in chart `title` (PNG/SVG export filename slug). Typically
		 * a shorter form than displayName. */
		chartTitlePrefix: string;
		/** Inserted into the empty-state message: "No pressure response
		 * measurements available for {entityLabel}". */
		entityLabel: string;
	} = $props();

	// Per-session P100 estimates (max-force). Defective sessions are
	// excluded — they reflect a broken digitizer, not the pen's true
	// saturation force.
	let p100Values = $derived(
		pressureSessions
			.filter((s) => !defectsByInventoryId.has(s.InventoryId))
			.map((s) => estimateP100(s.Records))
			.filter((v): v is number => v !== null && isFinite(v)),
	);

	let p100Stats = $derived.by(() => {
		const xs = [...p100Values].sort((a, b) => a - b);
		if (xs.length === 0) return null;
		const min = xs[0];
		const max = xs[xs.length - 1];
		const mid = Math.floor(xs.length / 2);
		const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
		return { min, median, max };
	});

	type View = 'all' | 'summary';
	let view = $state<View>('all');

	let allMarkers: BandMarker[] = $derived(p100Values.map((v) => ({ value: v, dashed: false })));

	let summaryMarkers: BandMarker[] = $derived(
		p100Stats
			? [
					{ value: p100Stats.min, dashed: false },
					{ value: p100Stats.max, dashed: false },
					{ value: p100Stats.median, label: 'Median', dashed: false, strokeWidth: 4 },
				]
			: [],
	);

	let currentMarkers = $derived(view === 'all' ? allMarkers : summaryMarkers);
	let currentShadedRange = $derived(
		view === 'summary' && p100Stats ? { min: p100Stats.min, max: p100Stats.max } : undefined,
	);
	let currentHeading = $derived(
		view === 'all' ? `${displayName} — All max pressures` : `${displayName} — Max pressure range`,
	);
	let currentTitle = $derived(
		view === 'all'
			? `${chartTitlePrefix} max pressure`
			: `${chartTitlePrefix} max pressure summary`,
	);
</script>

<p class="ref-blurb">
	Maximum physical pressure is the force at which the digitizer saturates (reports its maximum
	pressure value). Each red line marks the estimated <strong>P100</strong> (max-force) for {entityLabel}.
</p>

{#if p100Stats}
	<div class="view-toggle" role="group" aria-label="View">
		<button
			type="button"
			class:active={view === 'all'}
			onclick={() => (view = 'all')}
			aria-pressed={view === 'all'}>All sessions ({p100Values.length})</button
		>
		<button
			type="button"
			class:active={view === 'summary'}
			onclick={() => (view = 'summary')}
			aria-pressed={view === 'summary'}>Summary (min / median / max)</button
		>
	</div>
	<p class="ref-blurb view-blurb">
		{#if view === 'all'}
			One red line per measurement session.
		{:else}
			Outer lines mark <strong>min</strong> and <strong>max</strong>; the thick line marks the
			<strong>median</strong>; the shaded band spans the full range.
		{/if}
	</p>
{/if}

<BandsChart
	bands={MAX_PRESSURE_BANDS}
	axisMax={1000}
	axisStep={100}
	unit="gf"
	title={currentTitle}
	heading={currentHeading}
	markers={currentMarkers}
	shadedRange={currentShadedRange}
/>

{#if p100Stats}
	<table class="p100-summary-table">
		<thead>
			<tr>
				<th>Min<br /><span class="unit">(gf)</span></th>
				<th>Median<br /><span class="unit">(gf)</span></th>
				<th>Max<br /><span class="unit">(gf)</span></th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td class="mono">{fmtP(p100Stats.min)}</td>
				<td class="mono">{fmtP(p100Stats.median)}</td>
				<td class="mono">{fmtP(p100Stats.max)}</td>
			</tr>
		</tbody>
	</table>
	<p class="ref-blurb summary-blurb">
		Pressure response near saturation — the same chart from the Pressure Response tab, zoomed to the
		95–100% region so you can compare each session's approach to P100.
	</p>
	<PressureChart
		sessions={chartSessions}
		title={`${chartTitlePrefix} pressure response (max)`}
		{hiddenIds}
		lockedZoom="max"
	/>
{:else}
	<p class="no-data">No pressure response measurements available for {entityLabel}.</p>
{/if}

<style>
	.ref-blurb {
		font-size: 13px;
		color: var(--text-muted);
		max-width: 800px;
		margin: 0 0 12px;
	}
	.view-blurb {
		margin-top: 4px;
	}
	.summary-blurb {
		margin-top: 16px;
	}
	.no-data {
		font-size: 13px;
		color: var(--text-muted);
		font-style: italic;
	}

	.view-toggle {
		display: inline-flex;
		gap: 0;
		margin: 0 0 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		overflow: hidden;
	}
	.view-toggle button {
		appearance: none;
		border: none;
		background: var(--bg-card);
		color: var(--text-muted);
		padding: 5px 12px;
		font-size: 12px;
		cursor: pointer;
		border-right: 1px solid var(--border);
	}
	.view-toggle button:last-child {
		border-right: none;
	}
	.view-toggle button:hover {
		color: var(--text);
	}
	.view-toggle button.active {
		background: var(--bg);
		color: #6b21a8;
		font-weight: 600;
	}

	.p100-summary-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 12px 0;
	}
	.p100-summary-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}
	.p100-summary-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.p100-summary-table td {
		padding: 6px 14px;
		font-variant-numeric: tabular-nums;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
</style>
