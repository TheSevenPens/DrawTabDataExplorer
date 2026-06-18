<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import EntityLink from '$lib/components/EntityLink.svelte';
	import BandsChart, { type BandMarker } from '$lib/components/BandsChart.svelte';
	import { PIAF_BANDS, PMAX_BANDS } from '$lib/bands.js';
	import type { PressureResponse, PressureRange } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import { fmtP } from '$data/lib/pressure/interpolate.js';
	import { resolveRangeByUnit, type RangeMetric } from '$data/lib/pressure/range-resolve.js';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import { slugify } from '$lib/chart-export/filenames.js';

	let {
		metric,
		pressureSessions,
		measurements = [],
		defectsByInventoryId,
		displayName,
		chartTitlePrefix,
		entityLabel,
		penNameById = new Map<string, string>(),
		tabletNameById = new Map<string, string>(),
	}: {
		metric: RangeMetric;
		pressureSessions: PressureResponse[];
		/** Direct measurements for this metric, scoped to the entity. Measured
		 * values for a unit win over its estimated samples. */
		measurements?: PressureRange[];
		defectsByInventoryId: ReadonlyMap<string, DefectInfo>;
		/** Used in the chart `heading` overlay, e.g. "Wacom Pro Pen 3 (KP-504E)". */
		displayName: string;
		/** Used in chart `title` (export filename slug); typically shorter. */
		chartTitlePrefix: string;
		/** Inserted into the empty-state message: "No {metric} data available for
		 * {entityLabel}". */
		entityLabel: string;
		/** PenEntityId → label, for the Pen column (shown only when the resolved
		 * units span more than one pen model). */
		penNameById?: ReadonlyMap<string, string>;
		/** TabletEntityId → label, for the by-sample Tablet column. */
		tabletNameById?: ReadonlyMap<string, string>;
	} = $props();

	// IAF bands top out at AVOID (≥5 gf) but real values reach the low 20s, so
	// the axis runs to 22 gf with markers hard-clamped. MAX uses the full
	// 0–1000 gf range.
	let bands = $derived(metric === 'IAF' ? PIAF_BANDS : PMAX_BANDS);
	let axisMax = $derived(metric === 'IAF' ? 22 : 1000);
	let axisStep = $derived(metric === 'IAF' ? 1 : 100);
	let showUnitInAxis = $derived(metric !== 'IAF');

	let nonDefectiveSessions = $derived(
		pressureSessions.filter((s) => !defectsByInventoryId.has(s.InventoryId)),
	);

	// One resolved value per pen unit: direct measurement wins, else the median
	// estimate across the unit's sessions. Sorted by value ascending.
	let resolved = $derived(
		[...resolveRangeByUnit(metric, nonDefectiveSessions, measurements)].sort(
			(a, b) => a.value - b.value,
		),
	);

	let measuredCount = $derived(resolved.filter((r) => r.source === 'measured').length);
	let estimatedCount = $derived(resolved.length - measuredCount);

	// The resolved-source datapoints, flattened for the by-sample view. Grouped
	// by unit, then chronological.
	let samples = $derived(
		resolved
			.flatMap((u) => u.samples)
			.slice()
			.sort((a, b) =>
				a.inventoryId === b.inventoryId
					? a.date.localeCompare(b.date)
					: a.inventoryId.localeCompare(b.inventoryId),
			),
	);

	// The Pen column only earns its space when more than one pen model is in
	// play (a family or compare view). On a single-model page it just repeats.
	let showPenColumn = $derived(new Set(resolved.map((r) => r.penEntityId)).size > 1);

	function penName(id: string): string {
		return penNameById.get(id) ?? id;
	}
	function tabletName(id: string): string {
		return id ? (tabletNameById.get(id) ?? id) : '';
	}

	let stats = $derived.by(() => {
		const xs = resolved.map((r) => r.value).sort((a, b) => a - b);
		if (xs.length === 0) return null;
		const min = xs[0];
		const max = xs[xs.length - 1];
		const mid = Math.floor(xs.length / 2);
		const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
		return { min, median, max };
	});

	type View = 'summary' | 'unit' | 'sample';
	let view = $state<View>('summary');

	const clamp = (v: number) => Math.min(v, axisMax);

	let summaryMarkers: BandMarker[] = $derived(
		stats
			? [
					{ value: clamp(stats.min), dashed: false },
					{ value: clamp(stats.max), dashed: false },
					{ value: clamp(stats.median), label: 'Median', dashed: false, strokeWidth: 4 },
				]
			: [],
	);
	// By unit / by sample: solid for measured, dashed for the estimated
	// fallback, so trustworthy values read distinctly.
	let unitMarkers: BandMarker[] = $derived(
		resolved.map((r) => ({ value: clamp(r.value), dashed: r.source === 'estimated' })),
	);
	let sampleMarkers: BandMarker[] = $derived(
		samples.map((s) => ({ value: clamp(s.value), dashed: s.source === 'estimated' })),
	);

	let currentMarkers = $derived(
		view === 'summary' ? summaryMarkers : view === 'unit' ? unitMarkers : sampleMarkers,
	);
	let currentShadedRange = $derived(
		view === 'summary' && stats ? { min: clamp(stats.min), max: clamp(stats.max) } : undefined,
	);

	let viewWord = $derived(view === 'summary' ? 'range' : view === 'unit' ? 'by unit' : 'by sample');
	let currentHeading = $derived(`${displayName} — ${metric} ${viewWord}`);
	let currentTitle = $derived(
		`${chartTitlePrefix} ${metric} ${view === 'summary' ? 'summary' : viewWord}`,
	);

	let chartSubtitle = $derived.by(() => {
		if (resolved.length === 0) return undefined;
		const fmt = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
		return `${fmt(resolved.length, 'pen unit', 'pen units')} · ${measuredCount} measured · ${estimatedCount} estimated`;
	});

	let nameSlug = $derived(slugify(chartTitlePrefix) || 'pen');
	let metricLower = $derived(metric.toLowerCase());

	let summaryExportRows = $derived<(string | number)[][]>(
		stats
			? [
					['Min', fmtP(stats.min)],
					['Median', fmtP(stats.median)],
					['Max', fmtP(stats.max)],
				]
			: [],
	);
	let unitExportHeaders = $derived([
		...(showPenColumn ? ['Pen'] : []),
		'Inventory ID',
		`${metric} (gf)`,
		'Source',
		'Samples',
	]);
	let unitExportRows = $derived<(string | number)[][]>(
		resolved.map((r) => [
			...(showPenColumn ? [penName(r.penEntityId)] : []),
			r.inventoryId,
			fmtP(r.value),
			r.source,
			r.count,
		]),
	);
	let sampleExportHeaders = $derived([
		...(showPenColumn ? ['Pen'] : []),
		'Inventory ID',
		'Date',
		'Tablet',
		'Driver',
		`${metric} (gf)`,
		'Source',
	]);
	let sampleExportRows = $derived<(string | number)[][]>(
		samples.map((s) => [
			...(showPenColumn ? [penName(s.penEntityId)] : []),
			s.inventoryId,
			s.date,
			tabletName(s.tabletEntityId),
			s.driver,
			fmtP(s.value),
			s.source,
		]),
	);
</script>

{#if stats}
	<div class="view-toggle" role="group" aria-label="View">
		<button
			type="button"
			class:active={view === 'summary'}
			onclick={() => (view = 'summary')}
			aria-pressed={view === 'summary'}>Summary (min / median / max)</button
		>
		<button
			type="button"
			class:active={view === 'unit'}
			onclick={() => (view = 'unit')}
			aria-pressed={view === 'unit'}>By unit ({resolved.length})</button
		>
		<button
			type="button"
			class:active={view === 'sample'}
			onclick={() => (view = 'sample')}
			aria-pressed={view === 'sample'}>By sample ({samples.length})</button
		>
	</div>
{/if}

<BandsChart
	{bands}
	{axisMax}
	{axisStep}
	unit="gf"
	{showUnitInAxis}
	showBandRanges={false}
	title={currentTitle}
	heading={currentHeading}
	subtitle={chartSubtitle}
	markers={currentMarkers}
	shadedRange={currentShadedRange}
/>

{#if view !== 'summary' && estimatedCount > 0 && measuredCount > 0}
	<p class="source-legend">
		<span class="swatch solid"></span> measured &nbsp;·&nbsp;
		<span class="swatch dashed"></span> estimated (fallback)
	</p>
{/if}

{#if stats}
	{#if view === 'summary'}
		<div class="table-block">
			<div class="table-toolbar">
				<span class="table-label">{metric} — min / median / max</span>
				<ExportTableButton
					entityType="pressure-range"
					title={`${displayName} — ${metric} summary`}
					filename={`${metricLower}-summary-${nameSlug}`}
					headers={['Statistic', `${metric} (gf)`]}
					rows={summaryExportRows}
				/>
			</div>
			<table class="range-summary-table">
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
		</div>
	{:else if view === 'unit'}
		<div class="table-block">
			<div class="table-toolbar">
				<span class="table-label">{metric} by unit</span>
				<ExportTableButton
					entityType="pressure-range"
					title={`${displayName} — ${metric} by unit`}
					filename={`${metricLower}-by-unit-${nameSlug}`}
					headers={unitExportHeaders}
					rows={unitExportRows}
				/>
			</div>
			<table class="range-table">
				<thead>
					<tr>
						{#if showPenColumn}<th>Pen</th>{/if}
						<th>Inventory ID</th>
						<th class="num">{metric}<br /><span class="unit">(gf)</span></th>
						<th>Source</th>
						<th class="num" title="Number of datapoints">n</th>
					</tr>
				</thead>
				<tbody>
					{#each resolved as r (r.inventoryId)}
						<tr>
							{#if showPenColumn}
								<td>
									<EntityLink entityId={r.penEntityId}>{penName(r.penEntityId)}</EntityLink>
								</td>
							{/if}
							<td class="mono">{r.inventoryId}</td>
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
							<td class="num mono">{r.count}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="table-block">
			<div class="table-toolbar">
				<span class="table-label">{metric} by sample</span>
				<ExportTableButton
					entityType="pressure-range"
					title={`${displayName} — ${metric} by sample`}
					filename={`${metricLower}-by-sample-${nameSlug}`}
					headers={sampleExportHeaders}
					rows={sampleExportRows}
				/>
			</div>
			<table class="range-table">
				<thead>
					<tr>
						{#if showPenColumn}<th>Pen</th>{/if}
						<th>Inventory ID</th>
						<th>Date</th>
						<th>Tablet</th>
						<th>Driver</th>
						<th class="num">{metric}<br /><span class="unit">(gf)</span></th>
						<th>Source</th>
					</tr>
				</thead>
				<tbody>
					{#each samples as s, i (s.inventoryId + '|' + s.date + '|' + i)}
						<tr>
							{#if showPenColumn}
								<td>
									<EntityLink entityId={s.penEntityId}>{penName(s.penEntityId)}</EntityLink>
								</td>
							{/if}
							<td class="mono">
								{#if s.sessionEntityId}
									<EntityLink entityId={s.sessionEntityId}>{s.inventoryId}</EntityLink>
								{:else}
									{s.inventoryId}
								{/if}
							</td>
							<td class="mono">
								{#if s.sessionEntityId}
									<EntityLink entityId={s.sessionEntityId}>{s.date}</EntityLink>
								{:else}
									{s.date}
								{/if}
							</td>
							<td>
								{#if s.tabletEntityId}
									<EntityLink entityId={s.tabletEntityId}>{tabletName(s.tabletEntityId)}</EntityLink
									>
								{/if}
							</td>
							<td class="mono">{s.driver}</td>
							<td class="num mono">{fmtP(s.value)}</td>
							<td>
								{#if s.source === 'measured'}
									<span class="tag measured">measured</span>
								{:else}
									<span class="tag estimated">est.</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{:else}
	<EmptyState>No {metric} data available for {entityLabel}.</EmptyState>
{/if}

<style>
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
		color: var(--text);
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

	.table-block {
		margin: 16px 0;
	}
	.table-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		max-width: 640px;
		margin-bottom: 6px;
	}
	.table-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.range-summary-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 0;
		width: fit-content;
	}
	.range-summary-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.range-summary-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.range-summary-table td {
		padding: 6px 14px;
		font-variant-numeric: tabular-nums;
	}
	.range-summary-table tr {
		border-bottom: 1px solid var(--border);
	}
	.range-summary-table tr:last-child {
		border-bottom: none;
	}

	.range-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 0;
		width: fit-content;
	}
	.range-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
		vertical-align: bottom;
	}
	.range-table th.num {
		text-align: right;
	}
	.range-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.range-table td {
		padding: 5px 14px;
		border-bottom: 1px solid var(--border);
		font-variant-numeric: tabular-nums;
	}
	.range-table td.num {
		text-align: right;
	}
	.range-table tr:last-child td {
		border-bottom: none;
	}
	.range-table tr:hover td {
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
