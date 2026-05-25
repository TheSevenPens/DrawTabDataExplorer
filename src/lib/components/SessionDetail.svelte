<script lang="ts">
	import { resolve } from '$app/paths';
	import { type PressureResponse, type Pen, type Tablet } from '$data/lib/drawtab-loader.js';
	import { penFullName } from '$lib/pen-helpers.js';
	import { tabletFullName } from '$lib/tablet-helpers.js';
	import { estimateP00, estimateP100, fmtP } from '$data/lib/pressure/interpolate.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	let {
		data,
	}: {
		data: {
			session: PressureResponse;
			pen: Pen | undefined;
			tablet: Tablet | undefined;
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

	let p00 = $derived(estimateP00(session.Records));
	let p100 = $derived(estimateP100(session.Records));

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
			<a href={resolve('/entity/[entityId]', { entityId: session.PenEntityId })}>{penLabel}</a>
		</dd>
		<dt>Inventory ID</dt>
		<dd class="mono">{session.InventoryId}</dd>
		<dt>Date</dt>
		<dd class="mono">{session.Date}</dd>
		<dt>Tablet</dt>
		<dd>
			<a href={resolve('/entity/[entityId]', { entityId: session.TabletEntityId })}>
				{tabletLabel}
			</a>
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
		<dt>IAF (P00 est.)</dt>
		<dd>{fmtP(p00)} gf</dd>
		<dt>Max Force (P100 est.)</dt>
		<dd>{fmtP(p100)} gf</dd>
		<dt>Records</dt>
		<dd>{session.Records.length}</dd>
	</dl>
</section>

<section class="raw">
	<h2>Raw Records</h2>
	<table>
		<thead>
			<tr>
				<th>#</th>
				<th>Force (gf)</th>
				<th>Pressure (%)</th>
			</tr>
		</thead>
		<tbody>
			{#each session.Records as [x, y], i (i)}
				<tr>
					<td class="num">{i + 1}</td>
					<td class="num mono">{x.toFixed(2)}</td>
					<td class="num mono">{y.toFixed(2)}</td>
				</tr>
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
	.raw table {
		width: 100%;
		max-width: 480px;
		border-collapse: collapse;
		font-size: 13px;
	}
	.raw thead th {
		text-align: left;
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
</style>
