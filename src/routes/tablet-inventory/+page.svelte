<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadInventoryTabletsFromURL, loadTabletsFromURL } from '$data/lib/drawtab-loader.js';
	import { tabletFullName } from '$lib/tablet-helpers.js';
	import {
		type InventoryTablet,
		INVENTORY_TABLET_FIELDS,
		INVENTORY_TABLET_FIELD_GROUPS,
		INVENTORY_TABLET_DEFAULT_COLUMNS,
		INVENTORY_TABLET_DEFAULT_VIEW,
	} from '$data/lib/entities/inventory-tablet-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import { flaggedCount } from '$lib/flagged-store.js';

	let tabletTabs = $derived([
		{ href: '/tablets', label: 'Tablet models' },
		{ href: '/tablet-families', label: 'Tablet families' },
		{ href: '/tablet-analysis', label: 'Analysis' },
		{ href: '/tablet-inventory', label: 'Inventory' },
		{ href: '/tablet-compare', label: 'Compare', badge: $flaggedCount },
	]);

	let tablets: InventoryTablet[] = $state([]);
	let tabletNameMap: Record<string, string> = $state({});

	onMount(async () => {
		const [inv, allTablets] = await Promise.all([
			loadInventoryTabletsFromURL(base, 'sevenpens'),
			loadTabletsFromURL(base),
		]);
		const map: Record<string, string> = {};
		for (const t of allTablets) {
			map[t.Meta.EntityId] = tabletFullName(t);
		}
		tabletNameMap = map;
		tablets = inv as unknown as InventoryTablet[];
	});
</script>

<Nav />
<SubNav tabs={tabletTabs} />
<EntityExplorer
	title="Tablet Inventory (sevenpens)"
	entityType="inventory-tablets"
	entityLabel="tablets"
	data={tablets}
	fields={INVENTORY_TABLET_FIELDS}
	fieldGroups={INVENTORY_TABLET_FIELD_GROUPS}
	defaultColumns={INVENTORY_TABLET_DEFAULT_COLUMNS}
	defaultView={INVENTORY_TABLET_DEFAULT_VIEW}
	defaultFilterField="Brand"
	defaultSortField="InventoryId"
	quickFilterFields={['Brand']}
	cellLinks={{
		TabletEntityId: (item: InventoryTablet) => {
			const name = tabletNameMap[item.TabletEntityId] ?? item.TabletEntityId;
			return [{ label: name, href: `${base}/entity/${encodeURIComponent(item.TabletEntityId)}` }];
		},
	}}
/>
