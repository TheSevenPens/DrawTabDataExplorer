<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { brandName, type Tablet, type Pen } from '$data/lib/drawtab-loader.js';
	import { DrawTabDataSet } from '$data/lib/dataset.js';
	import {
		type EnrichedPenCompat,
		PEN_COMPAT_FIELDS,
		PEN_COMPAT_FIELD_GROUPS,
		PEN_COMPAT_DEFAULT_COLUMNS,
		PEN_COMPAT_DEFAULT_VIEW,
	} from '$data/lib/entities/pen-compat-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import { tabletFullName as fmtTabletFullName } from '$lib/tablet-helpers.js';
	import { penFullName } from '$lib/pen-helpers.js';
	import SubNav from '$lib/components/SubNav.svelte';

	const dataTabs = [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-dictionary', label: 'Data Dictionary' },
		{ href: '/data-quality', label: 'Data Quality' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/wacom-driver-compat', label: 'Driver Compat' },
	];

	let data: EnrichedPenCompat[] = $state([]);

	onMount(async () => {
		const ds = new DrawTabDataSet({ kind: 'url', baseUrl: base });
		const [compat, tablets, pens] = await Promise.all([
			ds.PenCompat.toArray(),
			ds.Tablets.toArray(),
			ds.Pens.toArray(),
		]);

		const tabletMap = new Map<string, Tablet>();
		for (const t of tablets) {
			tabletMap.set(t.Model.Id, t);
		}

		const penMap = new Map<string, Pen>();
		for (const p of pens) {
			penMap.set(p.PenId, p);
		}

		data = compat.map((c) => {
			const tablet = tabletMap.get(c.TabletId);
			const pen = penMap.get(c.PenId);
			const tabletFullName = tablet
				? fmtTabletFullName(tablet)
				: `${brandName(c.Brand)} ${c.TabletId}`;
			const penFmt = pen ? penFullName(pen) : `${brandName(c.Brand)} ${c.PenId}`;
			return { ...c, TabletFullName: tabletFullName, PenFullName: penFmt };
		});
	});
</script>

<Nav />
<SubNav tabs={dataTabs} />
<EntityExplorer
	title="Pen Compatibility"
	entityType="pen-compat"
	entityLabel="compatibility rows"
	{data}
	fields={PEN_COMPAT_FIELDS}
	fieldGroups={PEN_COMPAT_FIELD_GROUPS}
	defaultColumns={PEN_COMPAT_DEFAULT_COLUMNS}
	defaultView={PEN_COMPAT_DEFAULT_VIEW}
	defaultFilterField="TabletFullName"
	defaultSortField="TabletFullName"
	quickFilterFields={['Brand']}
/>
