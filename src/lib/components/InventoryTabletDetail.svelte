<script lang="ts">
	import { resolve } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import DetailView from '$lib/components/DetailView.svelte';
	import {
		type InventoryTablet,
		INVENTORY_TABLET_FIELDS,
		INVENTORY_TABLET_FIELD_GROUPS,
	} from '$data/lib/entities/inventory-tablet-fields.js';
	import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';

	let { data } = $props();
	let item: InventoryTablet = $derived(data.item);
	let modelName: string = $derived(data.modelName ?? data.item.TabletEntityId);
	let bundledPens: InventoryPen[] = $derived(data.bundledPens ?? []);
	let penNameMap: Record<string, string> = $derived(data.penNameMap ?? {});
</script>

<Nav />

<div class="title-row">
	<h1>{item.InventoryId}</h1>
	<span class="model-link">
		<a href={resolve('/entity/[entityId]', { entityId: item.TabletEntityId })}>{modelName}</a>
	</span>
</div>

<DetailView
	item={{ ...item }}
	fields={INVENTORY_TABLET_FIELDS}
	fieldGroups={INVENTORY_TABLET_FIELD_GROUPS}
/>

{#if bundledPens.length > 0}
	<section class="bundled-section">
		<h2>Bundled Pens ({bundledPens.length})</h2>
		<table class="compat-table">
			<thead>
				<tr>
					<th>Inventory ID</th>
					<th>Pen</th>
					<th>Brand</th>
				</tr>
			</thead>
			<tbody>
				{#each bundledPens as p (p._id)}
					<tr>
						<td>
							<a href={resolve('/pen-inventory/[id]', { id: p._id })}>{p.InventoryId}</a>
						</td>
						<td>
							<a href={resolve('/entity/[entityId]', { entityId: p.PenEntityId })}>
								{penNameMap[p.PenEntityId] ?? p.PenEntityId}
							</a>
						</td>
						<td>{p.Brand}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
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
	.bundled-section {
		margin-top: 24px;
	}
	.bundled-section h2 {
		font-size: 16px;
		margin-bottom: 12px;
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
