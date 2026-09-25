<script lang="ts">
	import type { Tablet, Pen, TabletFamily } from '$data/lib/drawtab-loader.js';
	import { TABLET_FIELDS, TABLET_FIELD_GROUPS } from '$data/lib/entities/tablet-fields.js';
	import { formatValue } from '$data/lib/units.js';
	import { comparableFields, TABLET_FIELD_ROLES } from '$lib/field-roles.js';
	import { valueSuffix } from '$lib/field-display.js';
	import { unitPreference } from '$lib/unit-store.js';
	import { flaggedTablets, flaggedTabletFamilies } from '$lib/flagged-store.js';
	import { buildPenNameMap, formatPenIds } from '$lib/pen-helpers.js';
	import { tabletBrandAndName } from '$lib/tablet-helpers.js';
	import CompareWorkspace from '$lib/compare/CompareWorkspace.svelte';
	import TabletSizesView from '$lib/compare/TabletSizesView.svelte';
	import { tabletCompareData } from '$lib/compare/contexts';
	import type { MemberRef } from '$lib/compare/model';

	let { data } = $props();

	let allTablets = $derived(data.allTablets as Tablet[]);
	let penNameMap = $derived(buildPenNameMap(data.allPens as Pen[]));
	let compare = $derived(tabletCompareData(allTablets, data.tabletFamilies as TabletFamily[]));

	let flaggedRefs: MemberRef[] = $derived([
		...$flaggedTabletFamilies.map((id) => ({ type: 'family' as const, id })),
		...$flaggedTablets.map((id) => ({ type: 'model' as const, id: id.toLowerCase() })),
	]);

	// Identity and metadata rows restate the column headers (see field-roles).
	const FIELDS = comparableFields(TABLET_FIELDS, TABLET_FIELD_ROLES);

	function display(f: (typeof TABLET_FIELDS)[0], t: Tablet): string {
		if (f.key === 'ModelIncludedPen') return formatPenIds(t.Model.IncludedPen ?? [], penNameMap);
		// Model.Family stores the family EntityId; draw its name.
		if (f.key === 'ModelFamily' && t.Model.Family)
			return compare.ctx.familyName(t.Model.Family.toLowerCase()) ?? t.Model.Family;
		if (f.getDisplayValue) return f.getDisplayValue(t);
		const val = f.getValue(t);
		if (!val || val === '-') return '';
		return (
			formatValue(val, f.unit, $unitPreference) + valueSuffix(f.label, f.unit, $unitPreference)
		);
	}
</script>

<CompareWorkspace
	kind="tablets"
	ctx={compare.ctx}
	candidates={compare.candidates}
	{flaggedRefs}
	fields={FIELDS}
	groupOrder={TABLET_FIELD_GROUPS}
	{display}
	memberHeader={(t) => ({ id: t.Meta.EntityId, label: tabletBrandAndName(t) })}
	extraTabs={[{ id: 'sizes', label: 'Sizes' }]}
>
	{#snippet views(tab, columns, colors)}
		{#if tab === 'sizes'}
			<TabletSizesView {columns} {colors} {allTablets} />
		{/if}
	{/snippet}
</CompareWorkspace>
