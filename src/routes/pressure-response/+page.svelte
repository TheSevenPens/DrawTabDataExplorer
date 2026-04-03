<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadPressureResponseFromURL } from '$data/lib/drawtab-loader.js';
	import { type PressureResponse, PRESSURE_RESPONSE_FIELDS, PRESSURE_RESPONSE_FIELD_GROUPS, PRESSURE_RESPONSE_DEFAULT_COLUMNS, PRESSURE_RESPONSE_DEFAULT_VIEW } from '$data/lib/entities/pressure-response-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let data: PressureResponse[] = $state([]);

	interface PenModelSummary {
		penEntityId: string;
		sessionCount: number;
		inventoryIds: number;
	}

	let penModels: PenModelSummary[] = $state([]);

	onMount(async () => {
		data = await loadPressureResponseFromURL(base);

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

<section class="pen-models">
	<h2>Pen Models ({penModels.length})</h2>
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
					<td><a href="{base}/pressure-response/{encodeURIComponent(model.penEntityId)}">{model.penEntityId}</a></td>
					<td>{model.inventoryIds}</td>
					<td>{model.sessionCount}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</section>

<EntityExplorer
	title="All Sessions"
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

<style>
	h1 { margin-bottom: 16px; }

	.pen-models {
		margin-bottom: 24px;
	}

	.pen-models h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid #e0e0e0;
	}

	table.compact {
		width: auto;
		border-collapse: collapse;
		background: #fff;
		font-size: 13px;
		margin-bottom: 8px;
	}

	th, td {
		text-align: left;
		padding: 5px 10px;
		border-bottom: 1px solid #e0e0e0;
	}

	th {
		background: #333;
		color: #fff;
	}

	tr:hover td { background: #f0f7ff; }

	td a {
		color: #2563eb;
		text-decoration: none;
	}

	td a:hover { text-decoration: underline; }
</style>
