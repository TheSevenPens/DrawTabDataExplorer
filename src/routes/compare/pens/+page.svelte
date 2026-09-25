<script lang="ts">
	import type {
		Pen,
		PenFamily,
		PressureResponse,
		PressureRange,
	} from '$data/lib/drawtab-loader.js';
	import type { InventoryPen } from '$data/lib/entities/inventory-pen-fields.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import {
		PEN_FIELDS,
		PEN_FIELD_GROUPS,
		penIdRedundantInName,
	} from '$data/lib/entities/pen-fields.js';
	import { formatValue } from '$data/lib/units.js';
	import { comparableFields, PEN_FIELD_ROLES } from '$lib/field-roles.js';
	import { valueSuffix } from '$lib/field-display.js';
	import { unitPreference } from '$lib/unit-store.js';
	import { flaggedPenModels, flaggedPenFamilies, flaggedPenUnits } from '$lib/flagged-store.js';
	import { penBrandAndName } from '$lib/pen-helpers.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PressureRangeTab from '$lib/components/PressureRangeTab.svelte';
	import CompareWorkspace from '$lib/compare/CompareWorkspace.svelte';
	import PenPressureView from '$lib/compare/PenPressureView.svelte';
	import CompareRangeChart from '$lib/compare/CompareRangeChart.svelte';
	import { penCompareData } from '$lib/compare/contexts';
	import { columnMeasurements, columnSessions } from '$lib/compare/pen-groups';
	import type { MemberRef } from '$lib/compare/model';

	let { data } = $props();

	let allPens = $derived(data.allPens as Pen[]);
	let sessions = $derived(data.allSessions as PressureResponse[]);
	let defects = $derived(data.defectsByInventoryId as ReadonlyMap<string, DefectInfo>);
	let iaf = $derived(data.iafMeasurements as PressureRange[]);
	let max = $derived(data.maxMeasurements as PressureRange[]);
	let compare = $derived(
		penCompareData(allPens, data.penFamilies as PenFamily[], data.allInventory as InventoryPen[]),
	);

	let flaggedRefs: MemberRef[] = $derived([
		...$flaggedPenFamilies.map((id) => ({ type: 'family' as const, id })),
		...$flaggedPenModels.map((id) => ({ type: 'model' as const, id })),
		...$flaggedPenUnits.map((id) => ({ type: 'unit' as const, id })),
	]);

	let penNameById = $derived(
		new Map(
			allPens.map((p) => [
				p.EntityId,
				penIdRedundantInName(p) ? p.PenName : `${p.PenName} (${p.PenId})`,
			]),
		),
	);
	let penIdById = $derived(new Map(allPens.map((p) => [p.EntityId, p.PenId])));

	// Identity and metadata rows restate the column headers (see field-roles).
	const FIELDS = comparableFields(PEN_FIELDS, PEN_FIELD_ROLES);

	function display(f: (typeof PEN_FIELDS)[0], p: Pen): string {
		// Brand and PenFamily store a code / EntityId and draw a label (#332).
		if (f.getDisplayValue) return f.getDisplayValue(p);
		const val = f.getValue(p);
		if (val === undefined || val === null || val === '' || val === '-') return '';
		return (
			formatValue(val, f.unit, $unitPreference) + valueSuffix(f.label, f.unit, $unitPreference)
		);
	}
</script>

<CompareWorkspace
	kind="pens"
	ctx={compare.ctx}
	candidates={compare.candidates}
	{flaggedRefs}
	fields={FIELDS}
	groupOrder={PEN_FIELD_GROUPS}
	{display}
	memberHeader={(p) => ({ id: p.EntityId, label: penBrandAndName(p) })}
	extraTabs={[
		{ id: 'pressure', label: 'Pressure Response' },
		{ id: 'iaf', label: 'IAF' },
		{ id: 'max', label: 'MAX' },
	]}
>
	{#snippet views(tab, columns, colors)}
		{#if tab === 'pressure'}
			<PenPressureView
				{columns}
				{colors}
				{sessions}
				measurements={[...iaf, ...max]}
				defectsByInventoryId={defects}
				{penNameById}
				tabletNameById={data.tabletNameById}
			/>
		{:else if tab === 'iaf' || tab === 'max'}
			{#if columns.length > 1}
				<CompareRangeChart
					metric={tab === 'iaf' ? 'IAF' : 'MAX'}
					{columns}
					{colors}
					{sessions}
					measurements={tab === 'iaf' ? iaf : max}
					defectsByInventoryId={defects}
				/>
			{/if}
			{#each columns as col, i (col.id)}
				{@const colSessions = columnSessions(col, sessions)}
				{@const colMeasurements = columnMeasurements(col, tab === 'iaf' ? iaf : max)}
				<section class="range-col">
					<h2>
						<span class="swatch" style:background={colors[i]} aria-hidden="true"></span>{col.name}
					</h2>
					{#if colSessions.length === 0 && colMeasurements.length === 0}
						<EmptyState>No {tab.toUpperCase()} data for this column.</EmptyState>
					{:else}
						<PressureRangeTab
							metric={tab === 'iaf' ? 'IAF' : 'MAX'}
							pressureSessions={colSessions}
							measurements={colMeasurements}
							defectsByInventoryId={defects}
							displayName={col.name}
							chartTitlePrefix={col.name}
							entityLabel="this column"
							{penIdById}
							tabletNameById={data.tabletNameById}
						/>
					{/if}
				</section>
			{/each}
		{/if}
	{/snippet}
</CompareWorkspace>

<style>
	.range-col {
		margin-bottom: 28px;
	}

	.range-col h2 {
		font-size: var(--type-subhead);
		font-weight: 400;
		letter-spacing: var(--track-tight);
		margin: 0 0 8px 0;
	}

	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		margin-right: 8px;
	}
</style>
