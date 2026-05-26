<script lang="ts">
	import { resolve } from '$app/paths';
	import BandsChart, { type BandMarker } from '$lib/components/BandsChart.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import { IAF_BANDS } from '$lib/bands.js';
	import type { PressureResponse } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import { estimateP00, fmtP } from '$data/lib/pressure/interpolate.js';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';

	// Mirrors MaxPressureTab. Sessions passed to the embedded IAF-zoom
	// PressureChart so colors / hidden state stay in sync across tabs.
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
		tabletNameById = new Map<string, string>(),
	}: {
		pressureSessions: PressureResponse[];
		defectsByInventoryId: ReadonlyMap<string, DefectInfo>;
		chartSessions: ChartSession[];
		hiddenIds: ReadonlySet<string>;
		displayName: string;
		chartTitlePrefix: string;
		entityLabel: string;
		/** TabletEntityId → display label. When omitted the raw EntityId
		 * is shown. */
		tabletNameById?: ReadonlyMap<string, string>;
	} = $props();

	// IAF bands top out at AVOID (≥5 gf); statistical sampling shows real
	// values can reach into the low 20s, so the axis runs to 22 gf and
	// markers are hard-clamped so a freakishly stiff pen doesn't push
	// them off the chart.
	const AXIS_MAX = 22;
	const AXIS_STEP = 1;

	let nonDefectiveSessions = $derived(
		pressureSessions.filter((s) => !defectsByInventoryId.has(s.InventoryId)),
	);

	let p00Values = $derived(
		nonDefectiveSessions
			.map((s) => estimateP00(s.Records))
			.filter((v): v is number => v !== null && isFinite(v)),
	);

	// Per-session table rows: lowest force at which the pen actually
	// registered any pressure (logical > 0) vs. the extrapolated P00.
	// When `lowLogical` is at/near 0, P00 ≈ measured; when it's well above
	// 0, P00 is an extrapolation below the data.
	let perSessionRows = $derived(
		nonDefectiveSessions.map((s) => {
			let lowForce: number | null = null;
			let lowLogical: number | null = null;
			for (const [force, logical] of s.Records) {
				if (logical > 0 && (lowLogical === null || logical < lowLogical)) {
					lowLogical = logical;
					lowForce = force;
				}
			}
			return {
				session: s,
				id: s._id,
				inventoryId: s.InventoryId,
				date: s.Date,
				sessionId: sessionEntityId(s),
				lowForce,
				lowLogical,
				p00: estimateP00(s.Records),
			};
		}),
	);

	let p00Stats = $derived.by(() => {
		const xs = [...p00Values].sort((a, b) => a - b);
		if (xs.length === 0) return null;
		const min = xs[0];
		const max = xs[xs.length - 1];
		const mid = Math.floor(xs.length / 2);
		const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
		return { min, median, max };
	});

	type View = 'all' | 'summary';
	let view = $state<View>('all');

	let allMarkers: BandMarker[] = $derived(
		p00Values.map((v) => ({ value: Math.min(v, AXIS_MAX), dashed: false })),
	);

	let summaryMarkers: BandMarker[] = $derived(
		p00Stats
			? [
					{ value: Math.min(p00Stats.min, AXIS_MAX), dashed: false },
					{ value: Math.min(p00Stats.max, AXIS_MAX), dashed: false },
					{
						value: Math.min(p00Stats.median, AXIS_MAX),
						label: 'Median',
						dashed: false,
						strokeWidth: 4,
					},
				]
			: [],
	);

	let currentMarkers = $derived(view === 'all' ? allMarkers : summaryMarkers);
	let currentShadedRange = $derived(
		view === 'summary' && p00Stats
			? { min: Math.min(p00Stats.min, AXIS_MAX), max: Math.min(p00Stats.max, AXIS_MAX) }
			: undefined,
	);
	let currentHeading = $derived(
		view === 'all' ? `${displayName} — All IAF values` : `${displayName} — IAF range`,
	);
	let currentTitle = $derived(
		view === 'all' ? `${chartTitlePrefix} IAF` : `${chartTitlePrefix} IAF summary`,
	);

	let chartSubtitle = $derived.by(() => {
		if (nonDefectiveSessions.length === 0) return undefined;
		const models = new Set(nonDefectiveSessions.map((s) => s.PenEntityId)).size;
		const units = new Set(nonDefectiveSessions.map((s) => s.InventoryId)).size;
		const sessions = nonDefectiveSessions.length;
		const fmt = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
		return `${fmt(models, 'pen model', 'pen models')} · ${fmt(units, 'pen unit', 'pen units')} · ${fmt(sessions, 'session', 'sessions')}`;
	});
</script>

<p class="ref-blurb">
	Initial Activation Force (IAF) is the minimum force needed for the pen to register any pressure.
	Lower is better — a lighter touch means more natural shading and less hand fatigue. Each red line
	marks the estimated <strong>P00</strong> (activation force) for {entityLabel}.
</p>

{#if p00Stats}
	<div class="view-toggle" role="group" aria-label="View">
		<button
			type="button"
			class:active={view === 'all'}
			onclick={() => (view = 'all')}
			aria-pressed={view === 'all'}>All sessions ({p00Values.length})</button
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
	bands={IAF_BANDS}
	axisMax={AXIS_MAX}
	axisStep={AXIS_STEP}
	unit="gf"
	showUnitInAxis={false}
	title={currentTitle}
	heading={currentHeading}
	subtitle={chartSubtitle}
	markers={currentMarkers}
	shadedRange={currentShadedRange}
/>

{#if p00Stats}
	<table class="p00-summary-table">
		<tbody>
			<tr>
				<th>Min <span class="unit">(gf)</span></th>
				<td class="mono">{fmtP(p00Stats.min)}</td>
			</tr>
			<tr>
				<th>Median <span class="unit">(gf)</span></th>
				<td class="mono">{fmtP(p00Stats.median)}</td>
			</tr>
			<tr>
				<th>Max <span class="unit">(gf)</span></th>
				<td class="mono">{fmtP(p00Stats.max)}</td>
			</tr>
		</tbody>
	</table>

	<p class="ref-blurb summary-blurb">
		Per-session comparison: the lowest force at which the pen first registered pressure vs. the
		<strong>P00</strong> estimate (extrapolated to logical 0%). When the lowest measured logical pressure
		is well above 0%, P00 is an extrapolation below the data.
	</p>
	<table class="per-session-table">
		<thead>
			<tr>
				<th>Inventory ID</th>
				<th>Date</th>
				<th>Tablet</th>
				<th>Driver</th>
				<th class="num">
					Lowest measured
					<br /><span class="unit">(gf @ logical %)</span>
				</th>
				<th class="num">P00 estimate<br /><span class="unit">(gf)</span></th>
			</tr>
		</thead>
		<tbody>
			{#each perSessionRows as r (r.id)}
				<tr>
					<td class="mono">
						<a href={resolve('/entity/[entityId]', { entityId: r.sessionId })}>{r.inventoryId}</a>
					</td>
					<td class="mono">
						<a href={resolve('/entity/[entityId]', { entityId: r.sessionId })}>{r.date}</a>
					</td>
					<td>
						{#if r.session.TabletEntityId}
							<a href={resolve('/entity/[entityId]', { entityId: r.session.TabletEntityId })}>
								{tabletNameById.get(r.session.TabletEntityId) ?? r.session.TabletEntityId}
							</a>
						{/if}
					</td>
					<td class="mono">{r.session.Driver}</td>
					<td class="num mono">
						{r.lowForce !== null ? fmtP(r.lowForce) : '—'}
						{#if r.lowLogical !== null}
							<span class="logical-pct">@ {r.lowLogical.toFixed(1)}%</span>
						{/if}
					</td>
					<td class="num mono">{r.p00 !== null ? fmtP(r.p00) : '—'}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<p class="ref-blurb summary-blurb">
		Pressure response near activation — the same chart from the Pressure Response tab, zoomed to the
		IAF-detail region so you can compare each session's approach to P00.
	</p>
	<PressureChart
		sessions={chartSessions}
		title={`${chartTitlePrefix} pressure response (IAF)`}
		{hiddenIds}
		lockedZoom="iaf"
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

	.p00-summary-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 12px 0;
		width: fit-content;
	}
	.p00-summary-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.p00-summary-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.p00-summary-table td {
		padding: 6px 14px;
		font-variant-numeric: tabular-nums;
	}
	.p00-summary-table tr {
		border-bottom: 1px solid var(--border);
	}
	.p00-summary-table tr:last-child {
		border-bottom: none;
	}

	.per-session-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 8px 0 16px;
		width: fit-content;
	}
	.per-session-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
		vertical-align: bottom;
	}
	.per-session-table th.num {
		text-align: right;
	}
	.per-session-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.per-session-table td {
		padding: 5px 14px;
		border-bottom: 1px solid var(--border);
		font-variant-numeric: tabular-nums;
	}
	.per-session-table td.num {
		text-align: right;
	}
	.per-session-table tr:last-child td {
		border-bottom: none;
	}
	.per-session-table tr:hover td {
		background: var(--hover-bg);
	}
	.logical-pct {
		color: var(--text-dim);
		font-weight: normal;
		margin-left: 4px;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
</style>
