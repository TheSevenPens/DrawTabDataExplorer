<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { DrawTabDataSet } from '$data/lib/dataset.js';
	import {
		type PenFamily,
		PEN_FAMILY_FIELDS,
		PEN_FAMILY_FIELD_GROUPS,
		PEN_FAMILY_DEFAULT_COLUMNS,
		PEN_FAMILY_DEFAULT_VIEW,
		setPenFamilyMemberCounts,
	} from '$data/lib/entities/pen-family-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	import { flaggedPenTotalCount } from '$lib/flagged-store.js';

	let penTabs = $derived([
		{ href: '/pens', label: 'Pen models' },
		{ href: '/pen-families', label: 'Pen families' },
		{ href: '/pen-inventory', label: 'Inventory' },
		{ href: '/pen-flagged', label: 'Flagged', badge: $flaggedPenTotalCount },
		{ href: '/pressure-response', label: 'Pressure Response' },
	]);

	let data: PenFamily[] = $state([]);

	onMount(async () => {
		const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base });
		const [families, pens] = await Promise.all([ds.PenFamilies.toArray(), ds.Pens.toArray()]);
		const counts: Record<string, number> = {};
		for (const p of pens) {
			if (p.PenFamily) counts[p.PenFamily] = (counts[p.PenFamily] ?? 0) + 1;
		}
		setPenFamilyMemberCounts(counts);
		data = families as PenFamily[];
	});
</script>

<Nav />
<SubNav tabs={penTabs} />
<EntityExplorer
	title="Pen Families"
	entityType="pen-families"
	entityLabel="pen families"
	{data}
	fields={PEN_FAMILY_FIELDS}
	fieldGroups={PEN_FAMILY_FIELD_GROUPS}
	defaultColumns={PEN_FAMILY_DEFAULT_COLUMNS}
	defaultView={PEN_FAMILY_DEFAULT_VIEW}
	linkField="FamilyName"
	detailBasePath="/entity"
	defaultFilterField="EntityId"
	quickFilterFields={['Brand']}
/>
