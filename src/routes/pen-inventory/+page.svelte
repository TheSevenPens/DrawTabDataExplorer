<script lang="ts">
	import { base } from '$app/paths';
	import {
		type InventoryPen,
		INVENTORY_PEN_FIELDS,
		INVENTORY_PEN_FIELD_GROUPS,
		INVENTORY_PEN_DEFAULT_COLUMNS,
		INVENTORY_PEN_DEFAULT_VIEW,
	} from '$data/lib/entities/inventory-pen-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import { flaggedPenUnits, toggleFlaggedPenUnit } from '$lib/flagged-store.js';
	import { flaggedPenTotalCount } from '$lib/flagged-store.js';

	let { data } = $props();

	let penTabs = $derived([
		{ href: '/pens', label: 'Pen models' },
		{ href: '/pen-families', label: 'Pen families' },
		{ href: '/pen-inventory', label: 'Inventory' },
		{ href: '/pen-flagged', label: 'Flagged', badge: $flaggedPenTotalCount },
		{ href: '/pressure-response', label: 'Pressure Response' },
	]);

	// Inventory IDs are stored uppercase in the data; the flag store uses
	// lowercase. Normalize at the boundary so the flag column toggles
	// correctly and stays in sync with the Flagged sub-tab.
	let flaggedSet = $derived(new Set($flaggedPenUnits.map((id) => id.toUpperCase())));
</script>

<Nav />
<SubNav tabs={penTabs} />
<EntityExplorer
	title="Pen Inventory (sevenpens)"
	entityType="inventory-pens"
	entityLabel="pens"
	data={data.pens}
	fields={INVENTORY_PEN_FIELDS}
	fieldGroups={INVENTORY_PEN_FIELD_GROUPS}
	defaultColumns={INVENTORY_PEN_DEFAULT_COLUMNS}
	defaultView={INVENTORY_PEN_DEFAULT_VIEW}
	defaultFilterField="Brand"
	quickFilterFields={['Brand']}
	flaggedIds={flaggedSet}
	onToggleFlag={toggleFlaggedPenUnit}
	cellLinks={{
		InventoryId: (item: InventoryPen) => [
			{ label: item.InventoryId, href: `${base}/pen-inventory/${encodeURIComponent(item._id)}` },
		],
		PenEntityId: (item: InventoryPen) => {
			const name = data.penNameMap[item.PenEntityId];
			if (!name)
				return [
					{
						label: item.PenEntityId,
						href: `${base}/entity/${encodeURIComponent(item.PenEntityId)}`,
					},
				];
			return [{ label: name, href: `${base}/entity/${encodeURIComponent(item.PenEntityId)}` }];
		},
	}}
/>
