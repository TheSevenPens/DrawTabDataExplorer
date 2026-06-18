<script lang="ts">
	import EntityLink from '$lib/components/EntityLink.svelte';
	import { type PressureResponse, type Pen, type Tablet } from '$data/lib/drawtab-loader.js';
	import { penFullName } from '$lib/pen-helpers.js';
	import { tabletFullName } from '$lib/tablet-helpers.js';
	import {
		estimatePiaf,
		estimatePmax,
		fmtP,
		IAF_LOGICAL_PCT,
	} from '$data/lib/pressure/interpolate.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	let {
		data,
	}: {
		data: {
			session: PressureResponse;
			// Loader resolves these via session.getPen()/getTablet(), which return
			// null when the reference is dangling; the template guards with `pen ?`.
			pen: Pen | null;
			tablet: Tablet | null;
			defectInfo?: DefectInfo | null;
		};
	} = $props();

	import { flaggedPenTotalCount } from '$lib/flagged-store.js';
	import { penSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let penTabs = $derived(penSubNavTabs({ flaggedPenCount: $flaggedPenTotalCount }));

	let session = $derived(data.session);
	let pen = $derived(data.pen);
	let tablet = $derived(data.tablet);
	let defectInfo = $derived(data.defectInfo ?? null);
	let penLabel = $derived(pen ? penFullName(pen) : session.PenEntityId);
	let tabletLabel = $derived(tablet ? tabletFullName(tablet) : session.TabletEntityId);

	let piaf = $derived(estimatePiaf(session.Records));
	let pmax = $derived(estimatePmax(session.Records));

	// Combined raw records + estimated Piaf/Pmax endpoints, ordered by physical
	// force so each estimate sits at its true position in the curve rather than
	// just bracketing the list. Estimate rows are tagged so the template styles
	// them distinctly; raw rows keep their original capture index (`n`).
	type TableRow =
		| { kind: 'raw'; n: number; force: number; pct: number }
		| { kind: 'est'; label: string; force: number; pct: number };

	let tableRows = $derived.by<TableRow[]>(() => {
		const rows: TableRow[] = session.Records.map(([force, pct], i) => ({
			kind: 'raw',
			n: i + 1,
			force,
			pct,
		}));
		if (piaf !== null) rows.push({ kind: 'est', label: 'Piaf', force: piaf, pct: IAF_LOGICAL_PCT });
		if (pmax !== null) rows.push({ kind: 'est', label: 'Pmax', force: pmax, pct: 100 });
		return rows.sort((a, b) => a.force - b.force);
	});

	// Format a logical-pressure % for the records table. Two decimals for
	// normal values, but never round a genuinely non-zero reading down to
	// "0.00" — a tiny activation like 0.003% must stay visible, since the Piaf
	// estimate correctly counts it as non-zero (its bracket sits below it).
	function fmtPct(y: number): string {
		const rounded = y.toFixed(2);
		if (y !== 0 && parseFloat(rounded) === 0) return String(y);
		return rounded;
	}

	// Export mirrors what the table shows: raw rows plus the marked Piaf/Pmax
	// estimate rows, in force order.
	const recordExportHeaders = ['#', 'Force (gf)', 'Pressure (%)'];
	let recordExportRows: (string | number)[][] = $derived(
		tableRows.map((row) =>
			row.kind === 'est'
				? [`${row.label} (est.)`, fmtP(row.force), fmtPct(row.pct)]
				: [row.n, row.force.toFixed(2), fmtPct(row.pct)],
		),
	);

	// On a single-session detail page, the user explicitly navigated to this
	// session — the chart must render even if the pen unit is flagged
	// defective. (The defect banner above the chart conveys the warning;
	// PressureChart's default "hide defective" filter would otherwise
	// leave the canvas blank with only a "Show 1 defective" toggle, which
	// looks like a broken page rather than a deliberate safety filter.)
	let chartSessions = $derived([
		{
			label: `${session.InventoryId} ${session.Date}`,
			records: session.Records,
		},
	]);
</script>

<Nav />
<SubNav tabs={penTabs} />

<div class="header">
	<h1>Pressure Response Session</h1>
	{#if defectInfo}
		<div class="defect-banner" title={defectInfo.detailsLabel}>
			⚠ This pen unit is flagged as defective ({defectInfo.kindsLabel}). Curve and stats may not be
			representative of a healthy unit.
		</div>
	{/if}
	<dl class="meta">
		<dt>Pen</dt>
		<dd>
			<EntityLink entityId={session.PenEntityId}>{penLabel}</EntityLink>
		</dd>
		<dt>Inventory ID</dt>
		<dd class="mono">{session.InventoryId}</dd>
		<dt>Date</dt>
		<dd class="mono">{session.Date}</dd>
		<dt>Tablet</dt>
		<dd>
			<EntityLink entityId={session.TabletEntityId}>{tabletLabel}</EntityLink>
		</dd>
		<dt>Driver</dt>
		<dd class="mono">{session.Driver}</dd>
		<dt>OS</dt>
		<dd>{session.OS}</dd>
		{#if session.Notes}
			<dt>Notes</dt>
			<dd>{session.Notes}</dd>
		{/if}
	</dl>
</div>

<PressureChart sessions={chartSessions} />

<section class="stats">
	<h2>Estimates</h2>
	<dl>
		<dt>Piaf (est.)</dt>
		<dd>{fmtP(piaf)} gf</dd>
		<dt>Pmax (est.)</dt>
		<dd>{fmtP(pmax)} gf</dd>
		<dt>Records</dt>
		<dd>{session.Records.length}</dd>
	</dl>
</section>

<section class="raw">
	<div class="raw-head">
		<h2>Raw Records</h2>
		<ExportTableButton
			entityType="pressure-response"
			title={`Pressure records — ${session.InventoryId} ${session.Date}`}
			filename={`pressure-records-${session.InventoryId}-${session.Date}`}
			headers={recordExportHeaders}
			rows={recordExportRows}
		/>
	</div>
	<table>
		<thead>
			<tr>
				<th>#</th>
				<th>Force (gf)</th>
				<th>Pressure (%)</th>
			</tr>
		</thead>
		<tbody>
			{#each tableRows as row (row.kind === 'raw' ? `r${row.n}` : `e${row.label}`)}
				{#if row.kind === 'est'}
					<tr class="est-row">
						<td class="est-label">{row.label} <span class="est-tag">est.</span></td>
						<td class="num mono">{fmtP(row.force)}</td>
						<td class="num mono">{fmtPct(row.pct)}</td>
					</tr>
				{:else}
					<tr>
						<td class="num">{row.n}</td>
						<td class="num mono">{row.force.toFixed(2)}</td>
						<td class="num mono">{fmtPct(row.pct)}</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</section>

<style>
	.header {
		margin-bottom: 16px;
	}
	.defect-banner {
		margin: 8px 0 12px;
		padding: 10px 14px;
		background: #fff3cd;
		border: 1px solid #d97706;
		border-left: 4px solid #d97706;
		color: #533f03;
		border-radius: 4px;
		font-size: 13px;
	}
	h1 {
		margin: 0 0 12px;
	}
	.meta {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px 16px;
		margin: 0;
		font-size: 13px;
	}
	.meta dt {
		color: var(--text-muted);
		font-weight: 600;
		text-transform: uppercase;
		font-size: 11px;
		align-self: center;
	}
	.meta dd {
		margin: 0;
	}
	.stats {
		margin-top: 24px;
	}
	.stats h2,
	.raw h2 {
		font-size: 16px;
		margin: 0 0 8px;
	}
	.stats dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px 16px;
		font-size: 13px;
	}
	.stats dt {
		color: var(--text-muted);
		font-weight: 600;
	}
	.stats dd {
		margin: 0;
	}
	.raw {
		margin-top: 24px;
	}
	.raw-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 480px;
		margin-bottom: 8px;
	}
	.raw-head h2 {
		margin: 0;
	}
	.raw table {
		width: 100%;
		max-width: 480px;
		border-collapse: collapse;
		font-size: 13px;
	}
	.raw thead th {
		text-align: right;
		padding: 4px 10px;
		border-bottom: 2px solid var(--border);
		background: var(--bg-card);
	}
	.raw tbody td {
		padding: 3px 10px;
		border-bottom: 1px solid var(--border);
	}
	.num {
		text-align: right;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.raw .est-row td {
		background: rgba(245, 158, 11, 0.13);
		font-style: italic;
	}
	.est-label {
		text-align: right;
		white-space: nowrap;
	}
	.est-tag {
		display: inline-block;
		font-style: normal;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		color: #92400e;
		background: #fde68a;
		padding: 0 5px;
		border-radius: 3px;
		margin-left: 6px;
	}
</style>
