<script lang="ts">
	import { resolve } from '$app/paths';
	import BandsChart, { type BandMarker } from '$lib/components/BandsChart.svelte';
	import { PIAF_BANDS } from '$lib/bands.js';
	import type { PressureResponse, PressureRange } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import { fmtP } from '$data/lib/pressure/interpolate.js';
	import { resolveIafByUnit } from '$data/lib/pressure/iaf-resolve.js';

	let {
		pressureSessions,
		defectsByInventoryId,
		displayName,
		chartTitlePrefix,
		entityLabel,
		iafMeasurements = [],
		penNameById = new Map<string, string>(),
	}: {
		pressureSessions: PressureResponse[];
		defectsByInventoryId: ReadonlyMap<string, DefectInfo>;
		displayName: string;
		chartTitlePrefix: string;
		entityLabel: string;
		/** Direct IAF measurements scoped to this entity. A measured value
		 * for a unit wins over its estimated Piaf. */
		iafMeasurements?: PressureRange[];
		/** PenEntityId → display label, used for the Pen column when the
		 * resolved units span more than one pen model (e.g. a pen family). */
		penNameById?: ReadonlyMap<string, string>;
	} = $props();

	// Piaf bands top out at AVOID (≥5 gf); statistical sampling shows real
	// values can reach into the low 20s, so the axis runs to 22 gf and
	// markers are hard-clamped so a freakishly stiff pen doesn't push
	// them off the chart.
	const AXIS_MAX = 22;
	const AXIS_STEP = 1;

	let nonDefectiveSessions = $derived(
		pressureSessions.filter((s) => !defectsByInventoryId.has(s.InventoryId)),
	);

	// One resolved IAF per pen unit: the direct measurement wins, otherwise
	// the median estimated Piaf across that unit's sessions. Sorted low→high
	// (lower IAF is better).
	let resolved = $derived(
		[...resolveIafByUnit(nonDefectiveSessions, iafMeasurements)].sort((a, b) => a.value - b.value),
	);

	let measuredCount = $derived(resolved.filter((r) => r.source === 'measured').length);
	let estimatedCount = $derived(resolved.length - measuredCount);
	let multiPen = $derived(new Set(resolved.map((r) => r.penEntityId)).size > 1);

	let stats = $derived.by(() => {
		const xs = resolved.map((r) => r.value).sort((a, b) => a - b);
		if (xs.length === 0) return null;
		const min = xs[0];
		const max = xs[xs.length - 1];
		const mid = Math.floor(xs.length / 2);
		const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
		return { min, median, max };
	});

	type View = 'all' | 'summary';
	let view = $state<View>('all');

	// "All" view: one marker per unit — solid for measured, dashed for the
	// estimated fallback, so trustworthy values read distinctly.
	let allMarkers: BandMarker[] = $derived(
		resolved.map((r) => ({ value: Math.min(r.value, AXIS_MAX), dashed: r.source === 'estimated' })),
	);

	let summaryMarkers: BandMarker[] = $derived(
		stats
			? [
					{ value: Math.min(stats.min, AXIS_MAX), dashed: false },
					{ value: Math.min(stats.max, AXIS_MAX), dashed: false },
					{
						value: Math.min(stats.median, AXIS_MAX),
						label: 'Median',
						dashed: false,
						strokeWidth: 4,
					},
				]
			: [],
	);

	let currentMarkers = $derived(view === 'all' ? allMarkers : summaryMarkers);
	let currentShadedRange = $derived(
		view === 'summary' && stats
			? { min: Math.min(stats.min, AXIS_MAX), max: Math.min(stats.max, AXIS_MAX) }
			: undefined,
	);
	let currentHeading = $derived(
		view === 'all' ? `${displayName} — IAF by unit` : `${displayName} — IAF range`,
	);
	let currentTitle = $derived(
		view === 'all' ? `${chartTitlePrefix} IAF` : `${chartTitlePrefix} IAF summary`,
	);

	let chartSubtitle = $derived.by(() => {
		if (resolved.length === 0) return undefined;
		const fmt = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
		return `${fmt(resolved.length, 'pen unit', 'pen units')} · ${measuredCount} measured · ${estimatedCount} estimated`;
	});
</script>

{#if stats}
	<div class="view-toggle" role="group" aria-label="View">
		<button
			type="button"
			class:active={view === 'all'}
			onclick={() => (view = 'all')}
			aria-pressed={view === 'all'}>By unit ({resolved.length})</button
		>
		<button
			type="button"
			class:active={view === 'summary'}
			onclick={() => (view = 'summary')}
			aria-pressed={view === 'summary'}>Summary (min / median / max)</button
		>
	</div>
{/if}

<BandsChart
	bands={PIAF_BANDS}
	axisMax={AXIS_MAX}
	axisStep={AXIS_STEP}
	unit="gf"
	showUnitInAxis={false}
	showBandRanges={false}
	title={currentTitle}
	heading={currentHeading}
	subtitle={chartSubtitle}
	markers={currentMarkers}
	shadedRange={currentShadedRange}
/>

{#if view === 'all' && estimatedCount > 0 && measuredCount > 0}
	<p class="source-legend">
		<span class="swatch solid"></span> measured &nbsp;·&nbsp;
		<span class="swatch dashed"></span> estimated (fallback)
	</p>
{/if}

{#if stats}
	<table class="piaf-summary-table">
		<tbody>
			<tr>
				<th>Min <span class="unit">(gf)</span></th>
				<td class="mono">{fmtP(stats.min)}</td>
			</tr>
			<tr>
				<th>Median <span class="unit">(gf)</span></th>
				<td class="mono">{fmtP(stats.median)}</td>
			</tr>
			<tr>
				<th>Max <span class="unit">(gf)</span></th>
				<td class="mono">{fmtP(stats.max)}</td>
			</tr>
		</tbody>
	</table>
	<table class="per-unit-table">
		<thead>
			<tr>
				<th>Inventory ID</th>
				{#if multiPen}<th>Pen</th>{/if}
				<th class="num">IAF<br /><span class="unit">(gf)</span></th>
				<th>Source</th>
			</tr>
		</thead>
		<tbody>
			{#each resolved as r (r.inventoryId)}
				<tr>
					<td class="mono">{r.inventoryId}</td>
					{#if multiPen}
						<td>
							<a href={resolve('/entity/[entityId]', { entityId: r.penEntityId })}>
								{penNameById.get(r.penEntityId) ?? r.penEntityId}
							</a>
						</td>
					{/if}
					<td class="num mono">{fmtP(r.value)}</td>
					<td>
						{#if r.source === 'measured'}
							<span class="tag measured" title="Direct measurement ({r.count})">measured</span>
						{:else}
							<span
								class="tag estimated"
								title="Estimated from {r.count} pressure session{r.count === 1 ? '' : 's'}"
								>est.</span
							>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p class="no-data">No IAF data available for {entityLabel}.</p>
{/if}

<style>
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

	.source-legend {
		font-size: 12px;
		color: var(--text-muted);
		margin: 6px 0 0;
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.swatch {
		display: inline-block;
		width: 18px;
		height: 0;
		border-top: 2px solid #dc2626;
		vertical-align: middle;
	}
	.swatch.dashed {
		border-top-style: dashed;
	}

	.piaf-summary-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 12px 0;
		width: fit-content;
	}
	.piaf-summary-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.piaf-summary-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.piaf-summary-table td {
		padding: 6px 14px;
		font-variant-numeric: tabular-nums;
	}
	.piaf-summary-table tr {
		border-bottom: 1px solid var(--border);
	}
	.piaf-summary-table tr:last-child {
		border-bottom: none;
	}

	.per-unit-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 8px 0 16px;
		width: fit-content;
	}
	.per-unit-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
		vertical-align: bottom;
	}
	.per-unit-table th.num {
		text-align: right;
	}
	.per-unit-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.per-unit-table td {
		padding: 5px 14px;
		border-bottom: 1px solid var(--border);
		font-variant-numeric: tabular-nums;
	}
	.per-unit-table td.num {
		text-align: right;
	}
	.per-unit-table tr:last-child td {
		border-bottom: none;
	}
	.per-unit-table tr:hover td {
		background: var(--hover-bg);
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.tag {
		display: inline-block;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		padding: 1px 6px;
		border-radius: 3px;
	}
	.tag.measured {
		color: #166534;
		background: #dcfce7;
	}
	.tag.estimated {
		color: #92400e;
		background: #fde68a;
	}
</style>
