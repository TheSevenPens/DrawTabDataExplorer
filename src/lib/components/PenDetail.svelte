<script lang="ts">
	import { base } from '$app/paths';
	import { brandName, type Tablet, type PressureResponse } from '$data/lib/drawtab-loader.js';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import { estimateP00, estimateP100, fmtP } from '$data/lib/pressure/interpolate.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import Nav from '$lib/components/Nav.svelte';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS } from '$data/lib/entities/pen-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import JsonDialog from '$lib/components/JsonDialog.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import { flaggedPenModels, toggleFlaggedPenModel } from '$lib/flagged-store.js';

	let { data } = $props();
	let pen: Pen = $derived(data.pen);
	let compatibleTablets: Tablet[] = $derived(data.compatibleTablets);
	let includedWithTablets: Tablet[] = $derived(data.includedWithTablets);
	let pressureSessions: PressureResponse[] = $derived(data.pressureSessions ?? []);
	let pressureSessionCount = $derived(pressureSessions.length);
	let defectsByInventoryId: ReadonlyMap<string, DefectInfo> = $derived(
		data.defectsByInventoryId ?? new Map(),
	);

	let chartSessions = $derived(
		pressureSessions.map((s) => {
			const info = defectsByInventoryId.get(s.InventoryId);
			return {
				label: `${s.InventoryId} ${s.Date}`,
				records: s.Records,
				defective: !!info,
				defectInfo: info?.detailsLabel,
			};
		}),
	);

	let showJson = $state(false);
	let activeTab = $state<'specs' | 'tablets' | 'included' | 'pressure'>('specs');
</script>

<Nav />

<div class="title-row">
	<h1>{brandName(pen.Brand)} {pen.PenName}</h1>
	<FlagButton
		flagged={$flaggedPenModels.includes(pen.EntityId.toLowerCase())}
		onclick={() => toggleFlaggedPenModel(pen.EntityId)}
		label="Flag this pen model"
	/>
	<button class="json-btn" onclick={() => (showJson = true)}>JSON</button>
</div>

{#if showJson}
	<JsonDialog entity={pen} onclose={() => (showJson = false)} />
{/if}

<section class="basics">
	<dl class="basics-grid">
		<div class="basics-item">
			<dt>Brand</dt>
			<dd><a href="{base}/entity/{pen.Brand.toLowerCase()}">{brandName(pen.Brand)}</a></dd>
		</div>
		<div class="basics-item">
			<dt>Pen ID</dt>
			<dd>{pen.PenId}</dd>
		</div>
		{#if pen.PenYear}
			<div class="basics-item">
				<dt>Year</dt>
				<dd>{pen.PenYear}</dd>
			</div>
		{/if}
		{#if pen.PenFamily}
			<div class="basics-item">
				<dt>Family</dt>
				<dd>{pen.PenFamily}</dd>
			</div>
		{/if}
	</dl>
</section>

<div class="detail-tabs">
	<button class:active={activeTab === 'specs'} onclick={() => (activeTab = 'specs')}>Specs</button>
	<button class:active={activeTab === 'tablets'} onclick={() => (activeTab = 'tablets')}
		>Compatible Tablets</button
	>
	<button class:active={activeTab === 'included'} onclick={() => (activeTab = 'included')}
		>Included With</button
	>
	<button class:active={activeTab === 'pressure'} onclick={() => (activeTab = 'pressure')}
		>Pressure Response</button
	>
</div>

{#if activeTab === 'specs'}
	<div class="tab-content">
		<DetailView item={pen} fields={PEN_FIELDS} fieldGroups={PEN_FIELD_GROUPS} />
	</div>
{/if}

{#if activeTab === 'tablets'}
	<div class="tab-content">
		{#if compatibleTablets.length > 0}
			<table class="compat-table">
				<thead>
					<tr>
						<th>Tablet</th>
						<th>Year</th>
					</tr>
				</thead>
				<tbody>
					{#each compatibleTablets as tablet}
						<tr>
							<td
								><a href="{base}/entity/{encodeURIComponent(tablet.Meta.EntityId)}"
									>{brandName(tablet.Model.Brand)} {tablet.Model.Name} ({tablet.Model.Id})</a
								></td
							>
							<td>{tablet.Model.LaunchYear ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="no-data">No tablet compatibility data available for this pen.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'included'}
	<div class="tab-content">
		{#if includedWithTablets.length > 0}
			<ul class="entity-list">
				{#each includedWithTablets as tablet}
					<li>
						<a href="{base}/entity/{encodeURIComponent(tablet.Meta.EntityId)}"
							>{brandName(tablet.Model.Brand)} {tablet.Model.Name} ({tablet.Model.Id})</a
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="no-data">No tablets list this pen as included.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'pressure'}
	<div class="tab-content">
		{#if pressureSessionCount > 0}
			<p class="pr-summary">
				{pressureSessionCount} measurement session{pressureSessionCount === 1 ? '' : 's'} for this pen.
			</p>
			<PressureChart sessions={chartSessions} title={`${pen.PenName} pressure response`} />
			<SessionStats
				sessions={pressureSessions}
				title="Aggregated across sessions"
				{defectsByInventoryId}
			/>
			<table class="session-table">
				<thead>
					<tr>
						<th>Inventory ID</th>
						<th>Date</th>
						<th>Tablet</th>
						<th>Driver</th>
						<th>OS</th>
						<th>Records</th>
						<th>IAF (gf)</th>
						<th>Max (gf)</th>
					</tr>
				</thead>
				<tbody>
					{#each pressureSessions as s (s._id)}
						{@const defect = defectsByInventoryId.get(s.InventoryId)}
						<tr class:defective={!!defect}>
							<td class="mono">
								<a href="{base}/entity/{encodeURIComponent(sessionEntityId(s))}">
									{s.InventoryId}
								</a>
								{#if defect}
									<span class="defect-badge" title={defect.detailsLabel}>⚠</span>
								{/if}
							</td>
							<td class="mono">{s.Date}</td>
							<td class="mono">{s.TabletEntityId}</td>
							<td class="mono">{s.Driver}</td>
							<td>{s.OS}</td>
							<td class="num">{s.Records.length}</td>
							<td class="num mono">{fmtP(estimateP00(s.Records))}</td>
							<td class="num mono">{fmtP(estimateP100(s.Records))}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="no-data">No pressure response data available for this pen model.</p>
		{/if}
	</div>
{/if}

<style>
	.title-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}
	.title-row h1 {
		margin: 0;
	}

	.json-btn {
		padding: 4px 10px;
		font-size: 13px;
		border: 1px solid #6b7280;
		border-radius: 4px;
		background: var(--bg-card);
		color: #6b7280;
		cursor: pointer;
		font-weight: 600;
	}
	.json-btn:hover {
		background: #6b7280;
		color: #fff;
	}

	.basics {
		margin-bottom: 20px;
		padding: 12px 16px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.basics-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		margin: 0;
		padding: 0;
	}
	.basics-item {
		display: flex;
		flex-direction: column;
		padding: 4px 20px 4px 0;
		min-width: 100px;
	}
	.basics-item dt {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-dim);
		margin-bottom: 2px;
	}
	.basics-item dd {
		font-size: 13px;
		color: var(--text);
	}
	.basics-item dd a {
		color: var(--link);
		text-decoration: none;
	}
	.basics-item dd a:hover {
		text-decoration: underline;
	}

	.detail-tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--border);
		margin-bottom: 16px;
	}
	.detail-tabs button {
		padding: 6px 16px;
		font-size: 13px;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		position: relative;
		bottom: -2px;
	}
	.detail-tabs button:hover {
		color: #2563eb;
		background: var(--bg-card);
		border-color: var(--border);
	}
	.detail-tabs button.active {
		background: var(--bg);
		color: #2563eb;
		border-color: var(--border);
		font-weight: 600;
	}

	.tab-content {
		margin-bottom: 24px;
	}

	.entity-list {
		list-style: none;
		padding: 0;
	}
	.entity-list li {
		padding: 4px 0;
		font-size: 13px;
	}
	.entity-list a {
		color: var(--link);
		text-decoration: none;
	}
	.entity-list a:hover {
		text-decoration: underline;
	}

	.pr-summary {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0 0 12px;
	}

	.session-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		margin-top: 16px;
	}
	.session-table th {
		text-align: left;
		padding: 6px 10px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}
	.session-table td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}
	.session-table a {
		color: var(--link);
		text-decoration: none;
	}
	.session-table tr.defective {
		color: var(--text-muted);
	}
	.defect-badge {
		display: inline-block;
		margin-left: 4px;
		color: #d97706;
		font-weight: 700;
		cursor: help;
	}
	.session-table a:hover {
		text-decoration: underline;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.num {
		text-align: right;
	}

	.no-data {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
	}

	.compat-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.compat-table th {
		text-align: left;
		padding: 6px 10px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}
	.compat-table td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}
	.compat-table a {
		color: var(--link);
		text-decoration: none;
	}
	.compat-table a:hover {
		text-decoration: underline;
	}
</style>
