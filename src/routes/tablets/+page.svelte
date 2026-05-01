<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		loadTabletsFromURL,
		loadPensFromURL,
		type Tablet,
		type Pen,
	} from '$data/lib/drawtab-loader.js';
	import {
		TABLET_FIELDS,
		TABLET_FIELD_GROUPS,
		TABLET_DEFAULT_COLUMNS,
		TABLET_DEFAULT_VIEW,
	} from '$data/lib/entities/tablet-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import { flaggedTablets, flaggedCount, toggleFlag } from '$lib/flagged-store.js';

	let tabletTabs = $derived([
		{ href: '/tablets', label: 'Tablet models' },
		{ href: '/tablet-families', label: 'Tablet families' },
		{ href: '/tablet-analysis', label: 'Analysis' },
		{ href: '/compare-tablets', label: 'Compare', badge: $flaggedCount },
	]);
	import { buildPenNameMap } from '$lib/pen-helpers.js';

	let data: Tablet[] = $state([]);
	let pens: Pen[] = $state([]);
	let flaggedSet = $derived(new Set($flaggedTablets));

	let penNameMap = $derived(buildPenNameMap(pens));

	let cellLinks = $derived({
		ModelIncludedPen: (t: Tablet) =>
			(t.Model.IncludedPen ?? []).map((entityId) => ({
				label: penNameMap.get(entityId) ?? entityId,
				href: `${base}/entity/${encodeURIComponent(entityId)}`,
			})),
	});

	onMount(async () => {
		[data, pens] = await Promise.all([loadTabletsFromURL(base), loadPensFromURL(base)]);
	});
</script>

<Nav />
<SubNav tabs={tabletTabs} />
<EntityExplorer
	title="Tablets"
	entityType="tablets"
	entityLabel="tablets"
	{data}
	fields={TABLET_FIELDS}
	fieldGroups={TABLET_FIELD_GROUPS}
	defaultColumns={TABLET_DEFAULT_COLUMNS}
	defaultView={TABLET_DEFAULT_VIEW}
	detailBasePath="/entity"
	linkField="NameAndModelId"
	{cellLinks}
	defaultFilterField="Brand"
	defaultSortField="Brand"
	quickFilterFields={['Brand', 'ModelType', 'DigitizerSizeCategory']}
	flaggedIds={flaggedSet}
	onToggleFlag={toggleFlag}
/>
