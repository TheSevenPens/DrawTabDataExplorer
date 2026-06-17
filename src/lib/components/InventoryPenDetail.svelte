<script lang="ts">
	import { resolve } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import DetailView from '$lib/components/DetailView.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import PiafTab from '$lib/components/PiafTab.svelte';
	import PmaxTab from '$lib/components/PmaxTab.svelte';
	import Tabs, { type Tab } from '$lib/components/Tabs.svelte';
	import {
		type InventoryPen,
		INVENTORY_PEN_FIELDS,
		INVENTORY_PEN_FIELD_GROUPS,
	} from '$data/lib/entities/inventory-pen-fields.js';
	import type { PressureResponse } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import {
		buildSessionColors,
		buildChartSessions,
		toggleInSet,
	} from '$lib/pressure/chart-session-state.js';

	let { data } = $props();
	let item: InventoryPen = $derived(data.item);
	let modelName: string = $derived(data.modelName ?? data.item.PenEntityId);
	let pressureSessions: PressureResponse[] = $derived(data.pressureSessions ?? []);
	let defectsByInventoryId: ReadonlyMap<string, DefectInfo> = $derived(
		data.defectsByInventoryId ?? new Map(),
	);

	let sessionColors = $derived(buildSessionColors(pressureSessions));

	let chartSessions = $derived(
		buildChartSessions(pressureSessions, {
			colors: sessionColors,
			defectsByInventoryId,
			labelFor: (s) => `${s.Date}`,
		}),
	);

	let hiddenSessionIds = $state(new Set<string>());
	function toggleSessionVisibility(id: string) {
		hiddenSessionIds = toggleInSet(hiddenSessionIds, id);
	}

	let activeTab = $state<'specs' | 'pressure' | 'iaf' | 'max'>('specs');
</script>

<Nav />

<div class="title-row">
	<h1>{item.InventoryId}</h1>
	<span class="model-link">
		<a href={resolve('/entity/[entityId]', { entityId: item.PenEntityId })}>{modelName}</a>
	</span>
</div>

<Tabs
	tabs={[
		{ id: 'specs', label: 'Specs' },
		{ id: 'pressure', label: 'Pressure Response', badge: pressureSessions.length },
		{ id: 'iaf', label: 'IAF' },
		{ id: 'max', label: 'MAX' },
	] satisfies Tab[]}
	bind:active={activeTab}
/>

{#if activeTab === 'specs'}
	<div class="tab-content">
		<DetailView
			item={{ ...item }}
			fields={INVENTORY_PEN_FIELDS}
			fieldGroups={INVENTORY_PEN_FIELD_GROUPS}
		/>
	</div>
{/if}

{#if activeTab === 'pressure'}
	<div class="tab-content">
		{#if pressureSessions.length > 0}
			<PressureChart
				sessions={chartSessions}
				title={`${item.InventoryId} pressure response`}
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
				title={`Aggregated across sessions for ${item.InventoryId}`}
				{defectsByInventoryId}
			/>
		{:else}
			<p class="no-data">No pressure response sessions recorded for this pen unit.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'iaf'}
	<div class="tab-content">
		<PiafTab
			{pressureSessions}
			{defectsByInventoryId}
			displayName={`${modelName} ${item.InventoryId}`}
			chartTitlePrefix={item.InventoryId}
			entityLabel="this pen unit"
			iafMeasurements={data.iafMeasurements ?? []}
			penNameById={new Map([[item.PenEntityId, modelName]])}
		/>
	</div>
{/if}

{#if activeTab === 'max'}
	<div class="tab-content">
		<PmaxTab
			{pressureSessions}
			{defectsByInventoryId}
			{chartSessions}
			hiddenIds={hiddenSessionIds}
			displayName={`${modelName} ${item.InventoryId}`}
			chartTitlePrefix={item.InventoryId}
			entityLabel="this pen unit"
		/>
	</div>
{/if}

<style>
	.title-row {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 16px;
	}
	h1 {
		margin: 0;
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.model-link {
		font-size: 16px;
		color: var(--text-muted);
	}
	.model-link a {
		color: var(--link);
		text-decoration: none;
	}
	.model-link a:hover {
		text-decoration: underline;
	}
	.tab-content {
		margin-bottom: 24px;
	}
	.no-data {
		font-size: 13px;
		color: var(--text-muted);
		font-style: italic;
	}
</style>
