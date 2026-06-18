<script lang="ts">
	import { resolve } from '$app/paths';
	import { brandName, type Tablet } from '$data/lib/drawtab-loader.js';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import CompatEntityTable, { type CompatRow } from '$lib/components/CompatEntityTable.svelte';
	import { tabletBrandAndName } from '$lib/tablet-helpers.js';
	import { penFullName, comparePenByYearDesc } from '$lib/pen-helpers.js';

	let {
		tablet,
		compatiblePens,
		inventoryPenCounts = new Map<string, number>(),
	}: {
		tablet: Tablet;
		compatiblePens: Pen[];
		/** PenEntityId → count of that pen model owned in inventory. */
		inventoryPenCounts?: ReadonlyMap<string, number>;
	} = $props();

	let sortedPens: Pen[] = $derived([...compatiblePens].sort(comparePenByYearDesc));

	let rows: CompatRow[] = $derived(
		sortedPens.map((p) => ({
			href: resolve('/entity/[entityId]', { entityId: p.EntityId }),
			cells: [
				penFullName(p),
				brandName(p.Brand),
				p.PenYear ?? '',
				inventoryPenCounts.get(p.EntityId) ?? 0,
			],
		})),
	);
</script>

<CompatEntityTable
	columns={['Pen', 'Brand', 'Year', 'Inventory']}
	{rows}
	emptyMessage="No pen compatibility data available for this tablet."
	exportEntityType="tablet-pens"
	exportTitle={`Compatible Pens — ${tabletBrandAndName(tablet)}`}
	exportFilename={`${tablet.Meta.EntityId}-compatible-pens`}
	exportHeaders={['Pen', 'Entity ID', 'Brand', 'Year', 'Inventory']}
	exportRows={sortedPens.map((p) => [
		penFullName(p),
		p.EntityId,
		brandName(p.Brand),
		p.PenYear ?? '',
		inventoryPenCounts.get(p.EntityId) ?? 0,
	])}
/>
