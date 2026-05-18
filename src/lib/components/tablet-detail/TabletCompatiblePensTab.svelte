<script lang="ts">
	import { resolve } from '$app/paths';
	import { brandName, type Tablet } from '$data/lib/drawtab-loader.js';
	import { type Pen } from '$data/lib/entities/pen-fields.js';
	import CompatEntityTable, { type CompatRow } from '$lib/components/CompatEntityTable.svelte';
	import { tabletBrandAndName } from '$lib/tablet-helpers.js';
	import { penFullName, comparePenByYearDesc } from '$lib/pen-helpers.js';

	let { tablet, compatiblePens }: { tablet: Tablet; compatiblePens: Pen[] } = $props();

	let sortedPens: Pen[] = $derived([...compatiblePens].sort(comparePenByYearDesc));

	let rows: CompatRow[] = $derived(
		sortedPens.map((p) => ({
			href: resolve('/entity/[entityId]', { entityId: p.EntityId }),
			cells: [penFullName(p), brandName(p.Brand), p.PenYear ?? ''],
		})),
	);
</script>

<CompatEntityTable
	columns={['Pen', 'Brand', 'Year']}
	{rows}
	emptyMessage="No pen compatibility data available for this tablet."
	exportEntityType="tablet-pens"
	exportTitle={`Compatible Pens — ${tabletBrandAndName(tablet)}`}
	exportFilename={`${tablet.Meta.EntityId}-compatible-pens`}
	exportHeaders={['Pen', 'Entity ID', 'Brand', 'Year']}
	exportRows={sortedPens.map((p) => [
		penFullName(p),
		p.EntityId,
		brandName(p.Brand),
		p.PenYear ?? '',
	])}
/>
