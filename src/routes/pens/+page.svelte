<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { DrawTabDataSet } from '$data/lib/dataset.js';
	import {
		type Pen,
		PEN_FIELDS,
		PEN_FIELD_GROUPS,
		PEN_DEFAULT_COLUMNS,
		PEN_DEFAULT_VIEW,
		setPenFamilyNames,
	} from '$data/lib/entities/pen-fields.js';
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

	let data: Pen[] = $state([]);
	let familyNames: Record<string, string> = $state({});

	let cellLinks = $derived({
		PenFamily: (p: Pen) => {
			const id = p.PenFamily;
			if (!id) return [];
			return [
				{
					label: familyNames[id] ?? id,
					href: `${base}/entity/${encodeURIComponent(id)}`,
				},
			];
		},
	});

	onMount(async () => {
		const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base });
		const [pens, families] = await Promise.all([ds.Pens.toArray(), ds.PenFamilies.toArray()]);
		const map: Record<string, string> = {};
		for (const f of families) map[f.EntityId] = f.FamilyName;
		setPenFamilyNames(map);
		familyNames = map;
		data = pens as Pen[];
	});
</script>

<Nav />
<SubNav tabs={penTabs} />
<EntityExplorer
	title="Pens"
	entityType="pens"
	entityLabel="pens"
	{data}
	fields={PEN_FIELDS}
	fieldGroups={PEN_FIELD_GROUPS}
	defaultColumns={PEN_DEFAULT_COLUMNS}
	defaultView={PEN_DEFAULT_VIEW}
	linkField="FullName"
	detailBasePath="/entity"
	{cellLinks}
	defaultFilterField="PenFamily"
	defaultSortField="PenId"
	quickFilterFields={['Brand']}
/>
