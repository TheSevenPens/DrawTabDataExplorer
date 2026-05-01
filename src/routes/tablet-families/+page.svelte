<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { loadTabletFamiliesFromURL, loadTabletsFromURL } from '$data/lib/drawtab-loader.js';
	import {
		type TabletFamily,
		TABLET_FAMILY_FIELDS,
		TABLET_FAMILY_FIELD_GROUPS,
		TABLET_FAMILY_DEFAULT_COLUMNS,
		TABLET_FAMILY_DEFAULT_VIEW,
	} from '$data/lib/entities/tablet-family-fields.js';
	import EntityExplorer from '$lib/components/EntityExplorer.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';
	import { flaggedCount } from '$lib/flagged-store.js';

	let tabletTabs = $derived([
		{ href: '/', label: 'Tablet models' },
		{ href: '/tablet-families', label: 'Tablet families' },
		{ href: '/tablet-analysis', label: 'Analysis' },
		{ href: '/compare-tablets', label: 'Compare', badge: $flaggedCount },
	]);

	let data: any[] = $state([]);

	onMount(async () => {
		const [families, tablets] = await Promise.all([
			loadTabletFamiliesFromURL(base) as Promise<TabletFamily[]>,
			loadTabletsFromURL(base),
		]);

		// Build lookup: EntityId → { count, earliestYear }
		const familyStats = new Map<string, { count: number; earliestYear: number }>();
		for (const t of tablets) {
			const fid = t.Model.Family;
			if (!fid) continue;
			const year = parseInt(t.Model.LaunchYear ?? '');
			const existing = familyStats.get(fid);
			if (!existing) {
				familyStats.set(fid, { count: 1, earliestYear: isNaN(year) ? Infinity : year });
			} else {
				existing.count++;
				if (!isNaN(year) && year < existing.earliestYear) existing.earliestYear = year;
			}
		}

		data = families.map((f) => {
			const stats = familyStats.get(f.EntityId);
			return {
				...f,
				_tabletCount: stats?.count ?? 0,
				_earliestYear: stats && stats.earliestYear !== Infinity ? String(stats.earliestYear) : '',
			};
		});
	});
</script>

<Nav />
<SubNav tabs={tabletTabs} />
<EntityExplorer
	title="Tablet Families"
	entityType="tablet-families"
	entityLabel="tablet families"
	{data}
	fields={TABLET_FAMILY_FIELDS}
	fieldGroups={TABLET_FAMILY_FIELD_GROUPS}
	defaultColumns={TABLET_FAMILY_DEFAULT_COLUMNS}
	defaultView={TABLET_FAMILY_DEFAULT_VIEW}
	linkField="FamilyName"
	detailBasePath="/entity"
	defaultFilterField="FamilyName"
	defaultSortField="FamilyName"
	quickFilterFields={['Brand']}
/>
