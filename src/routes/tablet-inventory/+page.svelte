<script lang="ts">
	import { base } from '$app/paths';
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

	let { data } = $props();

	let tabletTabs = $derived([
		{ href: '/tablets', label: 'Tablet models' },
		{ href: '/tablet-families', label: 'Tablet families' },
		{ href: '/tablet-analysis', label: 'Analysis' },
		{ href: '/tablet-inventory', label: 'Inventory' },
		{ href: '/tablet-compare', label: 'Compare', badge: $flaggedCount },
	]);
</script>

<Nav />
<SubNav tabs={tabletTabs} />
<EntityExplorer
	title="Tablet Inventory (sevenpens)"
	entityType="inventory-tablets"
	entityLabel="tablets"
	data={data.tablets}
	fields={INVENTORY_TABLET_FIELDS}
	fieldGroups={INVENTORY_TABLET_FIELD_GROUPS}
	defaultColumns={INVENTORY_TABLET_DEFAULT_COLUMNS}
	defaultView={INVENTORY_TABLET_DEFAULT_VIEW}
	defaultFilterField="Brand"
	quickFilterFields={['Brand']}
	cellLinks={{
		TabletEntityId: (item: InventoryTablet) => {
			const name = data.tabletNameMap[item.TabletEntityId] ?? item.TabletEntityId;
			return [{ label: name, href: `${base}/entity/${encodeURIComponent(item.TabletEntityId)}` }];
		},
	}}
/>
