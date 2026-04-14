<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadInventoryPensFromURL, loadInventoryTabletsFromURL, loadPensFromURL, brandName } from '$data/lib/drawtab-loader.js';
	import {
		type InventoryPen, INVENTORY_PEN_FIELDS, INVENTORY_PEN_FIELD_GROUPS,
		INVENTORY_PEN_DEFAULT_COLUMNS, INVENTORY_PEN_DEFAULT_VIEW,
	} from '$data/lib/entities/inventory-pen-fields.js';
	import {
		type InventoryTablet, INVENTORY_TABLET_FIELDS, INVENTORY_TABLET_FIELD_GROUPS,
		INVENTORY_TABLET_DEFAULT_COLUMNS, INVENTORY_TABLET_DEFAULT_VIEW,
	} from '$data/lib/entities/inventory-tablet-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let pens: InventoryPen[] = $state([]);
	let tablets: InventoryTablet[] = $state([]);
	let activeTab: 'pens' | 'tablets' = $state('pens');
	let penNameMap: Record<string, string> = $state({});

	onMount(async () => {
		const [p, t, allPens] = await Promise.all([
			loadInventoryPensFromURL(base, 'sevenpens'),
			loadInventoryTabletsFromURL(base, 'sevenpens'),
			loadPensFromURL(base),
		]);
		const map: Record<string, string> = {};
		for (const pen of allPens) {
			const name = pen.PenName === pen.PenId
				? `${brandName(pen.Brand)} ${pen.PenId}`
				: `${brandName(pen.Brand)} ${pen.PenName} (${pen.PenId})`;
			map[pen.EntityId] = name;
		}
		penNameMap = map;
		pens = p as unknown as InventoryPen[];
		tablets = t as unknown as InventoryTablet[];
	});
</script>

<Nav />
<h1>Inventory (sevenpens)</h1>

<div class="tabs">
	<button class:active={activeTab === 'pens'} onclick={() => activeTab = 'pens'}>
		Pens ({pens.length})
	</button>
	<button class:active={activeTab === 'tablets'} onclick={() => activeTab = 'tablets'}>
		Tablets ({tablets.length})
	</button>
</div>

{#if activeTab === 'pens'}
	<EntityExplorer
		title="Inventory Pens"
		entityType="inventory-pens"
		entityLabel="pens"
		data={pens}
		fields={INVENTORY_PEN_FIELDS}
		fieldGroups={INVENTORY_PEN_FIELD_GROUPS}
		defaultColumns={INVENTORY_PEN_DEFAULT_COLUMNS}
		defaultView={INVENTORY_PEN_DEFAULT_VIEW}
		defaultFilterField="Brand"
		defaultSortField="InventoryId"
		quickFilterFields={["Brand"]}
		cellLinks={{
			PenEntityId: (item: InventoryPen) => {
				const name = penNameMap[item.PenEntityId];
				if (!name) return [{ label: item.PenEntityId, href: `${base}/pens/${encodeURIComponent(item.PenEntityId)}` }];
				return [{ label: name, href: `${base}/pens/${encodeURIComponent(item.PenEntityId)}` }];
			}
		}}
	/>
{:else}
	<EntityExplorer
		title="Inventory Tablets"
		entityType="inventory-tablets"
		entityLabel="tablets"
		data={tablets}
		fields={INVENTORY_TABLET_FIELDS}
		fieldGroups={INVENTORY_TABLET_FIELD_GROUPS}
		defaultColumns={INVENTORY_TABLET_DEFAULT_COLUMNS}
		defaultView={INVENTORY_TABLET_DEFAULT_VIEW}
		defaultFilterField="Brand"
		defaultSortField="InventoryId"
		quickFilterFields={["Brand"]}
	/>
{/if}

<style>
	h1 { margin-bottom: 16px; }

	.tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
	}

	.tabs button {
		padding: 7px 16px;
		font-size: 13px;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: #fff;
		color: #555;
		cursor: pointer;
	}

	.tabs button:hover {
		border-color: #2563eb;
		color: #2563eb;
	}

	.tabs button.active {
		background: #2563eb;
		color: #fff;
		border-color: #2563eb;
	}
</style>
