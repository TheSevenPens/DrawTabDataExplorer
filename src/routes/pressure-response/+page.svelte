<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadPressureResponseFromURL, loadPensFromURL, type Pen } from '$data/lib/drawtab-loader.js';
	import { type PressureResponse, PRESSURE_RESPONSE_FIELDS, PRESSURE_RESPONSE_FIELD_GROUPS, PRESSURE_RESPONSE_DEFAULT_COLUMNS, PRESSURE_RESPONSE_DEFAULT_VIEW, setPenNameMap } from '$data/lib/entities/pressure-response-fields.js';
	import { buildPenNameMap } from '$lib/pen-helpers.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: PressureResponse[] = $state([]);
	let allPens: Pen[] = $state([]);
	let activeTab: 'pen-models' | 'sessions' = $state('pen-models');

	interface PenModelSummary {
		penEntityId: string;
		sessionCount: number;
		inventoryIds: number;
	}

	let penModels: PenModelSummary[] = $state([]);
	let penNameMap = $derived(buildPenNameMap(allPens));

	$effect(() => {
		setPenNameMap(penNameMap);
	});

	onMount(async () => {
		const [pressureData, pens] = await Promise.all([
			loadPressureResponseFromURL(base),
			loadPensFromURL(base),
		]);
		data = pressureData;
		allPens = pens;

		const modelMap = new Map<string, { sessions: number; inventoryIds: Set<string> }>();
		for (const s of data) {
			const existing = modelMap.get(s.PenEntityId);
			if (existing) {
				existing.sessions++;
				existing.inventoryIds.add(s.InventoryId);
			} else {
				modelMap.set(s.PenEntityId, { sessions: 1, inventoryIds: new Set([s.InventoryId]) });
			}
		}

		penModels = [...modelMap.entries()]
			.map(([penEntityId, info]) => ({
				penEntityId,
				sessionCount: info.sessions,
				inventoryIds: info.inventoryIds.size,
			}))
			.sort((a, b) => a.penEntityId.localeCompare(b.penEntityId));
	});
</script>

<Nav />

<h1>Pressure Response</h1>

<div class="tabs">
	<button class:active={activeTab === 'pen-models'} onclick={() => activeTab = 'pen-models'}>
		Pen Models ({penModels.length})
	</button>
	<button class:active={activeTab === 'sessions'} onclick={() => activeTab = 'sessions'}>
		Sessions ({data.length})
	</button>
</div>

{#if activeTab === 'pen-models'}
	<table class="compact">
		<thead>
			<tr>
				<th>Pen</th>
				<th>Pens Measured</th>
				<th>Sessions</th>
			</tr>
		</thead>
		<tbody>
			{#each penModels as model}
				<tr>
					<td><a href="{base}/pressure-response/{encodeURIComponent(model.penEntityId)}">{penNameMap.get(model.penEntityId) ?? model.penEntityId}</a></td>
					<td>{model.inventoryIds}</td>
					<td>{model.sessionCount}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<EntityExplorer
		title="All Sessions"
		titleTag="h2"
		entityType="pressure-response"
		entityLabel="sessions"
		{data}
		fields={PRESSURE_RESPONSE_FIELDS}
		fieldGroups={PRESSURE_RESPONSE_FIELD_GROUPS}
		defaultColumns={PRESSURE_RESPONSE_DEFAULT_COLUMNS}
		defaultView={PRESSURE_RESPONSE_DEFAULT_VIEW}
		defaultFilterField="Brand"
		defaultSortField="Date"
		quickFilterFields={["Brand"]}
	/>
{/if}

<style>
	h1 { margin-bottom: 16px; }

	.tabs {
		display: flex;
		gap: 0;
		border-bottom: 2px solid var(--border);
		margin-bottom: 20px;
	}

	.tabs button {
		padding: 7px 18px;
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

	.tabs button:hover {
		color: #2563eb;
		background: var(--hover-bg);
	}

	.tabs button.active {
		background: var(--bg-card);
		color: var(--text);
		font-weight: 600;
		border-color: var(--border);
		border-bottom-color: var(--bg-card);
	}

	table.compact {
		width: auto;
		border-collapse: collapse;
		background: var(--bg-card);
		font-size: 13px;
	}

	th, td {
		text-align: left;
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}

	th {
		background: var(--th-bg);
		color: var(--th-text);
	}

	tr:hover td { background: var(--hover-bg); }

	td a {
		color: var(--link);
		text-decoration: none;
	}

	td a:hover { text-decoration: underline; }
</style>
