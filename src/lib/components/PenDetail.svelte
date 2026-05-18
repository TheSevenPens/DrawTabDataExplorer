<script lang="ts">
	import { resolve } from '$app/paths';
	import { brandName, type Tablet, type PressureResponse } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import Nav from '$lib/components/Nav.svelte';
	import { type Pen, PEN_FIELDS, PEN_FIELD_GROUPS } from '$data/lib/entities/pen-fields.js';
	import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import JsonDialog from '$lib/components/JsonDialog.svelte';
	import CompatEntityTable, { type CompatRow } from '$lib/components/CompatEntityTable.svelte';
	import Tabs, { type Tab } from '$lib/components/Tabs.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import MaxPressureTab from '$lib/components/MaxPressureTab.svelte';
	import IafTab from '$lib/components/IafTab.svelte';
	import { tabletFullName, compareTabletByYearDesc } from '$lib/tablet-helpers.js';
	import { penBrandAndName } from '$lib/pen-helpers.js';
	import {
		buildSessionColors,
		buildChartSessions,
		toggleInSet,
	} from '$lib/pressure/chart-session-state.js';
	import { flaggedPenModels, toggleFlaggedPenModel } from '$lib/flagged-store.js';

	let { data } = $props();
	let pen: Pen = $derived(data.pen);
	let compatibleTablets: Tablet[] = $derived(
		[...data.compatibleTablets].sort(compareTabletByYearDesc),
	);
	let includedWithTablets: Tablet[] = $derived(
		[...data.includedWithTablets].sort(compareTabletByYearDesc),
	);
	let pressureSessions: PressureResponse[] = $derived(data.pressureSessions ?? []);
	let inventoryUnits: InventoryPen[] = $derived(data.inventoryUnits ?? []);
	let pressureSessionCount = $derived(pressureSessions.length);
	let defectsByInventoryId: ReadonlyMap<string, DefectInfo> = $derived(
		data.defectsByInventoryId ?? new Map(),
	);

	let sessionColors = $derived(buildSessionColors(pressureSessions));

	let chartSessions = $derived(
		buildChartSessions(pressureSessions, {
			colors: sessionColors,
			defectsByInventoryId,
		}),
	);

	let hiddenSessionIds = $state(new Set<string>());

	function toggleSessionVisibility(id: string) {
		hiddenSessionIds = toggleInSet(hiddenSessionIds, id);
	}

	let showJson = $state(false);
	let activeTab = $state<
		'specs' | 'tablets' | 'included' | 'inventory' | 'pressure' | 'iaf' | 'maxpressure'
	>('specs');

	function tabletExportRows(tablets: Tablet[]): (string | number)[][] {
		return tablets.map((t) => [
			tabletFullName(t),
			t.Meta.EntityId,
			t.Model.Type,
			t.Model.LaunchYear ?? '',
		]);
	}

	function tabletCompatRows(tablets: Tablet[]): CompatRow[] {
		return tablets.map((t) => ({
			href: resolve('/entity/[entityId]', { entityId: t.Meta.EntityId }),
			cells: [tabletFullName(t), t.Model.Type, t.Model.LaunchYear ?? ''],
		}));
	}
</script>

<Nav />

<div class="title-row">
	<h1>{penBrandAndName(pen)}</h1>
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
			<dd>
				<a href={resolve('/entity/[entityId]', { entityId: pen.Brand.toLowerCase() })}
					>{brandName(pen.Brand)}</a
				>
			</dd>
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

<Tabs
	tabs={[
		{ id: 'specs', label: 'Specs' },
		{ id: 'tablets', label: 'Compatible Tablets' },
		{ id: 'included', label: 'Included With' },
		{ id: 'inventory', label: 'Inventory', badge: inventoryUnits.length },
		{ id: 'pressure', label: 'Pressure Response' },
		{ id: 'iaf', label: 'IAF' },
		{ id: 'maxpressure', label: 'Max Pressure' },
	] satisfies Tab[]}
	bind:active={activeTab}
/>

{#if activeTab === 'specs'}
	<div class="tab-content">
		<DetailView item={pen} fields={PEN_FIELDS} fieldGroups={PEN_FIELD_GROUPS} />
	</div>
{/if}

{#if activeTab === 'tablets'}
	<div class="tab-content">
		<CompatEntityTable
			columns={['Tablet', 'Type', 'Year']}
			rows={tabletCompatRows(compatibleTablets)}
			emptyMessage="No tablet compatibility data available for this pen."
			exportEntityType="pen-tablets"
			exportTitle={`Compatible Tablets — ${penBrandAndName(pen)}`}
			exportFilename={`${pen.EntityId}-compatible-tablets`}
			exportHeaders={['Tablet', 'Entity ID', 'Type', 'Year']}
			exportRows={tabletExportRows(compatibleTablets)}
		/>
	</div>
{/if}

{#if activeTab === 'included'}
	<div class="tab-content">
		<CompatEntityTable
			columns={['Tablet', 'Type', 'Year']}
			rows={tabletCompatRows(includedWithTablets)}
			emptyMessage="No tablets list this pen as included."
			exportEntityType="pen-tablets"
			exportTitle={`Included With — ${penBrandAndName(pen)}`}
			exportFilename={`${pen.EntityId}-included-with-tablets`}
			exportHeaders={['Tablet', 'Entity ID', 'Type', 'Year']}
			exportRows={tabletExportRows(includedWithTablets)}
		/>
	</div>
{/if}

{#if activeTab === 'inventory'}
	<div class="tab-content">
		{#if inventoryUnits.length > 0}
			<table class="compat-table">
				<thead>
					<tr>
						<th>Inventory ID</th>
						<th>Tech</th>
						<th>Came With Tablet</th>
						<th>Defective</th>
					</tr>
				</thead>
				<tbody>
					{#each inventoryUnits as u (u._id)}
						<tr>
							<td><a href={resolve('/pen-inventory/[id]', { id: u._id })}>{u.InventoryId}</a></td>
							<td>{u.PenTech}{u.PenTechSubtype ? ` (${u.PenTechSubtype})` : ''}</td>
							<td>{u.WithTabletInventoryId || ''}</td>
							<td>{(u.Defects?.length ?? 0) > 0 ? 'YES' : ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="no-data">You don't own a unit of this pen model.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'iaf'}
	<div class="tab-content">
		<IafTab
			{pressureSessions}
			{defectsByInventoryId}
			{chartSessions}
			hiddenIds={hiddenSessionIds}
			displayName={penBrandAndName(pen)}
			chartTitlePrefix={pen.PenName}
			entityLabel="this pen model"
		/>
	</div>
{/if}

{#if activeTab === 'maxpressure'}
	<div class="tab-content">
		<MaxPressureTab
			{pressureSessions}
			{defectsByInventoryId}
			{chartSessions}
			hiddenIds={hiddenSessionIds}
			displayName={penBrandAndName(pen)}
			chartTitlePrefix={pen.PenName}
			entityLabel="this pen model"
		/>
	</div>
{/if}

{#if activeTab === 'pressure'}
	<div class="tab-content">
		{#if pressureSessionCount > 0}
			<p class="pr-summary">
				{pressureSessionCount} measurement session{pressureSessionCount === 1 ? '' : 's'} for this pen.
			</p>
			<PressureChart
				sessions={chartSessions}
				title={`${pen.PenName} pressure response`}
				hiddenIds={hiddenSessionIds}
			/>
			<PressureResponseChartLegendTable
				sessions={pressureSessions}
				colors={sessionColors}
				hiddenIds={hiddenSessionIds}
				onToggle={toggleSessionVisibility}
				{defectsByInventoryId}
			/>
			<SessionStats
				sessions={pressureSessions}
				title="Aggregated across sessions"
				{defectsByInventoryId}
			/>
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

	.tab-content {
		margin-bottom: 24px;
	}

	.pr-summary {
		font-size: 13px;
		color: var(--text-muted);
		margin: 0 0 12px;
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
