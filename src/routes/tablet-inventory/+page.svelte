<script lang="ts">
	import {
		INVENTORY_TABLET_FIELDS,
		INVENTORY_TABLET_FIELD_GROUPS,
		INVENTORY_TABLET_DEFAULT_COLUMNS,
		INVENTORY_TABLET_DEFAULT_VIEW,
	} from '$data/lib/entities/inventory-tablet-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import { flaggedCount } from '$lib/flagged-store.js';
	import { inventoryTabletCellLinks } from '$lib/inventory-cell-links.js';
	import { tabletSubNavTabs } from '$lib/nav/subnav-tabs.js';

	let { data } = $props();

	let tabletTabs = $derived(tabletSubNavTabs({ flaggedCount: $flaggedCount }));
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
	cellLinks={inventoryTabletCellLinks(data.tabletNameMap)}
/>
