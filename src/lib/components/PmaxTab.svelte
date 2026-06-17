<script lang="ts">
	import { resolve } from '$app/paths';
	import BandsChart, { type BandMarker } from '$lib/components/BandsChart.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import { PMAX_BANDS } from '$lib/bands.js';
	import type { PressureResponse } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import { estimatePmax, fmtP } from '$data/lib/pressure/interpolate.js';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';

	// Sessions passed to the embedded Pmax-zoom PressureChart. The parent
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
		tabletNameById = new Map<string, string>(),
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
		/** TabletEntityId → display label. When omitted the raw EntityId
		 * is shown. */
		tabletNameById?: ReadonlyMap<string, string>;
	} = $props();

	// Per-session Pmax estimates (max-force). Defective sessions are
	// excluded — they reflect a broken digitizer, not the pen's true
	// saturation force.
	let nonDefectiveSessions = $derived(
		pressureSessions.filter((s) => !defectsByInventoryId.has(s.InventoryId)),
	);

	let pmaxValues = $derived(
		nonDefectiveSessions
			.map((s) => estimatePmax(s.Records))
			.filter((v): v is number => v !== null && isFinite(v)),
	);

	// Per-session table rows: highest physically measured force and the
	// extrapolated Pmax (force at logical 100%). When `topLogical` is
	// noticeably below 100, Pmax is an extrapolation above the data; when
	// it's at 100, Pmax collapses to the measured value.
	let perSessionRows = $derived(
		nonDefectiveSessions.map((s) => {
			let topForce = -Infinity;
			let topLogical = -Infinity;
			for (const [force, logical] of s.Records) {
				if (force > topForce) topForce = force;
				if (logical > topLogical) topLogical = logical;
			}
			return {
				session: s,
				id: s._id,
				inventoryId: s.InventoryId,
				date: s.Date,
				sessionId: sessionEntityId(s),
				topForce: Number.isFinite(topForce) ? topForce : null,
				topLogical: Number.isFinite(topLogical) ? topLogical : null,
				pmax: estimatePmax(s.Records),
			};
		}),
	);

	let pmaxStats = $derived.by(() => {
		const xs = [...pmaxValues].sort((a, b) => a - b);
		if (xs.length === 0) return null;
		const min = xs[0];
		const max = xs[xs.length - 1];
		const mid = Math.floor(xs.length / 2);
		const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
		return { min, median, max };
	});

	type View = 'all' | 'summary';
	let view = $state<View>('all');

	let allMarkers: BandMarker[] = $derived(pmaxValues.map((v) => ({ value: v, dashed: false })));

	let summaryMarkers: BandMarker[] = $derived(
		pmaxStats
			? [
					{ value: pmaxStats.min, dashed: false },
					{ value: pmaxStats.max, dashed: false },
					{ value: pmaxStats.median, label: 'Median', dashed: false, strokeWidth: 4 },
				]
			: [],
	);

	let currentMarkers = $derived(view === 'all' ? allMarkers : summaryMarkers);
	let currentShadedRange = $derived(
		view === 'summary' && pmaxStats ? { min: pmaxStats.min, max: pmaxStats.max } : undefined,
	);
	let currentHeading = $derived(
		view === 'all' ? `${displayName} — All Pmax values` : `${displayName} — Pmax range`,
	);
	let currentTitle = $derived(
		view === 'all' ? `${chartTitlePrefix} Pmax` : `${chartTitlePrefix} Pmax summary`,
	);

	// Subtitle counts the distinct pen models / pen units / sessions
	// reflected in the chart. Mirrors the non-defective filter so the
	// counts match the rendered markers.
	let chartSubtitle = $derived.by(() => {
		if (nonDefectiveSessions.length === 0) return undefined;
		const models = new Set(nonDefectiveSessions.map((s) => s.PenEntityId)).size;
		const units = new Set(nonDefectiveSessions.map((s) => s.InventoryId)).size;
		const sessions = nonDefectiveSessions.length;
		const fmt = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
		return `${fmt(models, 'pen model', 'pen models')} · ${fmt(units, 'pen unit', 'pen units')} · ${fmt(sessions, 'session', 'sessions')}`;
	});

	function tabletName(id: string): string {
		return id ? (tabletNameById.get(id) ?? id) : '';
	}
	let nameSlug = $derived(
		chartTitlePrefix
			.replace(/[^a-z0-9]+/gi, '-')
			.replace(/^-+|-+$/g, '')
			.toLowerCase() || 'pen',
	);
	let summaryExportRows = $derived<(string | number)[][]>(
		pmaxStats
			? [
					['Min', fmtP(pmaxStats.min)],
					['Median', fmtP(pmaxStats.median)],
					['Max', fmtP(pmaxStats.max)],
				]
			: [],
	);
	let perSessionExportRows = $derived<(string | number)[][]>(
		perSessionRows.map((r) => [
			r.inventoryId,
			r.date,
			tabletName(r.session.TabletEntityId),
			r.session.Driver,
			r.topForce !== null ? fmtP(r.topForce) : '—',
			r.topLogical !== null ? r.topLogical.toFixed(1) : '—',
			r.pmax !== null ? fmtP(r.pmax) : '—',
		]),
	);
</script>

{#if pmaxStats}
	<div class="view-toggle" role="group" aria-label="View">
		<button
			type="button"
			class:active={view === 'all'}
			onclick={() => (view = 'all')}
			aria-pressed={view === 'all'}>All sessions ({pmaxValues.length})</button
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
	bands={PMAX_BANDS}
	axisMax={1000}
	axisStep={100}
	unit="gf"
	showBandRanges={false}
	title={currentTitle}
	heading={currentHeading}
	subtitle={chartSubtitle}
	markers={currentMarkers}
	shadedRange={currentShadedRange}
/>

{#if pmaxStats}
	<div class="table-block">
		<div class="table-toolbar">
			<span class="table-label">Pmax — min / median / max</span>
			<ExportTableButton
				entityType="pressure-response"
				title={`${displayName} — Pmax summary`}
				filename={`pmax-summary-${nameSlug}`}
				headers={['Statistic', 'Pmax (gf)']}
				rows={summaryExportRows}
			/>
		</div>
		<table class="pmax-summary-table">
			<tbody>
				<tr>
					<th>Min <span class="unit">(gf)</span></th>
					<td class="mono">{fmtP(pmaxStats.min)}</td>
				</tr>
				<tr>
					<th>Median <span class="unit">(gf)</span></th>
					<td class="mono">{fmtP(pmaxStats.median)}</td>
				</tr>
				<tr>
					<th>Max <span class="unit">(gf)</span></th>
					<td class="mono">{fmtP(pmaxStats.max)}</td>
				</tr>
			</tbody>
		</table>
	</div>

	<div class="table-block">
		<div class="table-toolbar">
			<span class="table-label">Pmax by session</span>
			<ExportTableButton
				entityType="pressure-response"
				title={`${displayName} — Pmax by session`}
				filename={`pmax-by-session-${nameSlug}`}
				headers={[
					'Inventory ID',
					'Date',
					'Tablet',
					'Driver',
					'Highest measured (gf)',
					'Highest logical (%)',
					'Pmax estimate (gf)',
				]}
				rows={perSessionExportRows}
			/>
		</div>
		<table class="per-session-table">
			<thead>
				<tr>
					<th>Inventory ID</th>
					<th>Date</th>
					<th>Tablet</th>
					<th>Driver</th>
					<th class="num">
						Highest measured
						<br /><span class="unit">(gf @ logical %)</span>
					</th>
					<th class="num">Pmax estimate<br /><span class="unit">(gf)</span></th>
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
							{r.topForce !== null ? fmtP(r.topForce) : '—'}
							{#if r.topLogical !== null}
								<span class="logical-pct">@ {r.topLogical.toFixed(1)}%</span>
							{/if}
						</td>
						<td class="num mono">{r.pmax !== null ? fmtP(r.pmax) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<PressureChart
		sessions={chartSessions}
		title={`${chartTitlePrefix} pressure response (Pmax)`}
		{hiddenIds}
		lockedZoom="pmax"
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

	.table-block {
		margin: 16px 0;
	}
	.table-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		max-width: 520px;
		margin-bottom: 6px;
	}
	.table-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.pmax-summary-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 0;
		width: fit-content;
	}
	.pmax-summary-table th {
		text-align: left;
		padding: 6px 14px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.pmax-summary-table th .unit {
		font-size: 11px;
		font-weight: 400;
	}
	.pmax-summary-table td {
		padding: 6px 14px;
		font-variant-numeric: tabular-nums;
	}
	.pmax-summary-table tr {
		border-bottom: 1px solid var(--border);
	}
	.pmax-summary-table tr:last-child {
		border-bottom: none;
	}

	.per-session-table {
		border-collapse: collapse;
		font-size: 13px;
		margin: 0;
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
