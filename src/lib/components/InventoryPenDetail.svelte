<script lang="ts">
	import { resolve } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import DetailView from '$lib/components/DetailView.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import Tabs, { type Tab } from '$lib/components/Tabs.svelte';
	import {
		type InventoryPen,
		INVENTORY_PEN_FIELDS,
		INVENTORY_PEN_FIELD_GROUPS,
	} from '$data/lib/entities/inventory-pen-fields.js';
	import type { PressureResponse } from '$data/lib/drawtab-loader.js';
	import { paletteColor } from '$lib/chart-palette.js';

	let { data } = $props();
	let item: InventoryPen = $derived(data.item);
	let modelName: string = $derived(data.modelName ?? data.item.PenEntityId);
	let pressureSessions: PressureResponse[] = $derived(data.pressureSessions ?? []);

	let sessionColors = $derived(new Map(pressureSessions.map((s, i) => [s._id, paletteColor(i)])));

	let chartSessions = $derived(
		pressureSessions.map((s) => ({
			id: s._id,
			label: `${s.Date}`,
			records: s.Records,
			color: sessionColors.get(s._id),
			defective: false,
			defectInfo: undefined,
		})),
	);

	let hiddenSessionIds = $state(new Set<string>());
	function toggleSessionVisibility(id: string) {
		const next = new Set(hiddenSessionIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		hiddenSessionIds = next;
	}

	let activeTab = $state<'specs' | 'pressure'>('specs');
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
			/>
			<SessionStats
				sessions={pressureSessions}
				title={`Aggregated across sessions for ${item.InventoryId}`}
			/>
		{:else}
			<p class="no-data">No pressure response sessions recorded for this pen unit.</p>
		{/if}
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
