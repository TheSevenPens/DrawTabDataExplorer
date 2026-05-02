<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		loadInventoryPensFromURL,
		loadPensFromURL,
		brandName,
	} from '$data/lib/drawtab-loader.js';
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

	let penTabs = $derived([
		{ href: '/pens', label: 'Pen models' },
		{ href: '/pen-families', label: 'Pen families' },
		{ href: '/pen-inventory', label: 'Inventory' },
		{ href: '/pen-flagged', label: 'Flagged', badge: $flaggedPenTotalCount },
		{ href: '/pressure-response', label: 'Pressure Response' },
	]);

	let pens: InventoryPen[] = $state([]);
	let penNameMap: Record<string, string> = $state({});

	onMount(async () => {
		const [p, allPens] = await Promise.all([
			loadInventoryPensFromURL(base, 'sevenpens'),
			loadPensFromURL(base),
		]);
		const map: Record<string, string> = {};
		for (const pen of allPens) {
			const name =
				pen.PenName === pen.PenId
					? `${brandName(pen.Brand)} ${pen.PenId}`
					: `${brandName(pen.Brand)} ${pen.PenName} (${pen.PenId})`;
			map[pen.EntityId] = name;
		}
		penNameMap = map;
		pens = p as unknown as InventoryPen[];
	});

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
	data={pens}
	fields={INVENTORY_PEN_FIELDS}
	fieldGroups={INVENTORY_PEN_FIELD_GROUPS}
	defaultColumns={INVENTORY_PEN_DEFAULT_COLUMNS}
	defaultView={INVENTORY_PEN_DEFAULT_VIEW}
	defaultFilterField="Brand"
	defaultSortField="InventoryId"
	quickFilterFields={['Brand']}
	flaggedIds={flaggedSet}
	onToggleFlag={toggleFlaggedPenUnit}
	cellLinks={{
		PenEntityId: (item: InventoryPen) => {
			const name = penNameMap[item.PenEntityId];
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
