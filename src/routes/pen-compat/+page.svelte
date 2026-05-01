<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		loadPenCompatFromURL,
		loadTabletsFromURL,
		loadPensFromURL,
		brandName,
		type Tablet,
		type Pen,
	} from '$data/lib/drawtab-loader.js';
	import {
		type EnrichedPenCompat,
		PEN_COMPAT_FIELDS,
		PEN_COMPAT_FIELD_GROUPS,
		PEN_COMPAT_DEFAULT_COLUMNS,
		PEN_COMPAT_DEFAULT_VIEW,
	} from '$data/lib/entities/pen-compat-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	const dataTabs = [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-quality', label: 'Data Quality' },
		{ href: '/pen-compat', label: 'Pen Compat' },
	];

	let data: EnrichedPenCompat[] = $state([]);

	onMount(async () => {
		const [compat, tablets, pens] = await Promise.all([
			loadPenCompatFromURL(base),
			loadTabletsFromURL(base),
			loadPensFromURL(base),
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
				? `${brandName(tablet.Model.Brand)} ${tablet.Model.Name} (${tablet.Model.Id})`
				: `${brandName(c.Brand)} ${c.TabletId}`;
			const penFullName = pen
				? pen.PenName === pen.PenId
					? `${brandName(pen.Brand)} ${pen.PenId}`
					: `${brandName(pen.Brand)} ${pen.PenName} (${pen.PenId})`
				: `${brandName(c.Brand)} ${c.PenId}`;
			return { ...c, TabletFullName: tabletFullName, PenFullName: penFullName };
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
