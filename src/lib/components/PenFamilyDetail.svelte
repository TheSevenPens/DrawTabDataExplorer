<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Pen, PressureResponse } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import {
		type PenFamily,
		PEN_FAMILY_FIELDS,
		PEN_FAMILY_FIELD_GROUPS,
	} from '$data/lib/entities/pen-family-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import Tabs, { type Tab } from '$lib/components/Tabs.svelte';
	import { comparePenByYearDesc } from '$lib/pen-helpers.js';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import PressureRangeTab from '$lib/components/PressureRangeTab.svelte';
	import { penIdRedundantInName } from '$data/lib/entities/pen-fields.js';
	import { penBrandAndName, penNameAndId } from '$lib/pen-helpers.js';
	import { flaggedPenFamilies, toggleFlaggedPenFamily } from '$lib/flagged-store.js';
	import {
		buildSessionColors,
		buildChartSessions,
		toggleInSet,
	} from '$lib/pressure/chart-session-state.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';

	let { data } = $props();
	let family: PenFamily = $derived(data.family);
	let memberPens: Pen[] = $derived(data.memberPens);
	let pressureSessions: PressureResponse[] = $derived(data.pressureSessions ?? []);
	let defectsByInventoryId: ReadonlyMap<string, DefectInfo> = $derived(
		data.defectsByInventoryId ?? new Map(),
	);

	// Build a per-pen label so the chart legend distinguishes models
	// within the same family.
	let penLabelById = $derived(new Map(memberPens.map((p) => [p.EntityId, penNameAndId(p)])));

	let sessionColors = $derived(buildSessionColors(pressureSessions));

	let chartSessions = $derived(
		buildChartSessions(pressureSessions, {
			colors: sessionColors,
			defectsByInventoryId,
			labelFor: (s) =>
				`${penLabelById.get(s.PenEntityId) ?? s.PenEntityId} · ${s.InventoryId} ${s.Date}`,
		}),
	);

	let hiddenSessionIds = $state(new Set<string>());

	function toggleSessionVisibility(id: string) {
		hiddenSessionIds = toggleInSet(hiddenSessionIds, id);
	}

	let activeTab = $state<'specs' | 'members' | 'pressure' | 'iaf' | 'max'>('specs');

	let sortedMemberPens: Pen[] = $derived([...memberPens].sort(comparePenByYearDesc));
</script>

<Nav />

<div class="title-row">
	<h1>{family.FamilyName}</h1>
	<FlagButton
		flagged={$flaggedPenFamilies.includes(family.EntityId.toLowerCase())}
		onclick={() => toggleFlaggedPenFamily(family.EntityId)}
		label="Flag this pen family"
	/>
</div>

<Tabs
	tabs={[
		{ id: 'specs', label: 'Specs' },
		{ id: 'members', label: 'Pens', badge: memberPens.length },
		{ id: 'pressure', label: 'Pressure Response', badge: pressureSessions.length },
		{ id: 'iaf', label: 'IAF' },
		{ id: 'max', label: 'MAX' },
	] satisfies Tab[]}
	bind:active={activeTab}
/>

{#if activeTab === 'specs'}
	<div class="tab-content">
		<DetailView item={family} fields={PEN_FAMILY_FIELDS} fieldGroups={PEN_FAMILY_FIELD_GROUPS} />
	</div>
{/if}

{#if activeTab === 'members'}
	<div class="tab-content">
		{#if sortedMemberPens.length > 0}
			<div class="table-header">
				<ExportTableButton
					entityType="pen-family-members"
					title={`${family.FamilyName} — Members`}
					filename={`${family.EntityId}-members`}
					headers={['Pen', 'Pen ID', 'Entity ID', 'Year']}
					rows={sortedMemberPens.map((p) => [
						penBrandAndName(p),
						p.PenId,
						p.EntityId,
						p.PenYear ?? '',
					])}
				/>
			</div>
			<table class="pen-table">
				<thead>
					<tr><th>Name</th><th>Year</th></tr>
				</thead>
				<tbody>
					{#each sortedMemberPens as p (p.EntityId)}
						<tr>
							<td>
								<a href={resolve('/entity/[entityId]', { entityId: p.EntityId })}>
									{penBrandAndName(p)}
									{#if !penIdRedundantInName(p)}<span class="dim">({p.PenId})</span>{/if}
								</a>
							</td>
							<td class="year">{p.PenYear || ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="dim">No pens are linked to this family.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'pressure'}
	<div class="tab-content">
		{#if pressureSessions.length > 0}
			<PressureChart
				sessions={chartSessions}
				title={`${family.FamilyName} pressure response`}
				hiddenIds={hiddenSessionIds}
			/>
			<PressureResponseChartLegendTable
				sessions={pressureSessions}
				colors={sessionColors}
				hiddenIds={hiddenSessionIds}
				onToggle={toggleSessionVisibility}
				penNameById={penLabelById}
				{defectsByInventoryId}
				showModel
			/>
			<SessionStats
				sessions={pressureSessions}
				title="Aggregated across sessions in this family"
				{defectsByInventoryId}
			/>
		{:else}
			<p class="dim">No pressure response data available for any pen in this family.</p>
		{/if}
	</div>
{/if}

{#if activeTab === 'iaf'}
	<div class="tab-content">
		<PressureRangeTab
			metric="IAF"
			{pressureSessions}
			{defectsByInventoryId}
			displayName={family.FamilyName}
			chartTitlePrefix={family.FamilyName}
			entityLabel="this family"
			measurements={data.iafMeasurements ?? []}
			penNameById={penLabelById}
			tabletNameById={data.tabletNameById ?? new Map()}
		/>
	</div>
{/if}

{#if activeTab === 'max'}
	<div class="tab-content">
		<PressureRangeTab
			metric="MAX"
			{pressureSessions}
			{defectsByInventoryId}
			displayName={family.FamilyName}
			chartTitlePrefix={family.FamilyName}
			entityLabel="this family"
			measurements={data.maxMeasurements ?? []}
			penNameById={penLabelById}
			tabletNameById={data.tabletNameById ?? new Map()}
		/>
	</div>
{/if}

<style>
	.title-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}
	.title-row h1 {
		margin: 0;
	}

	.tab-content {
		margin-bottom: 24px;
	}
	.table-header {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 8px;
	}

	.pen-table {
		border-collapse: collapse;
		font-size: 13px;
		width: 100%;
	}
	.pen-table th {
		text-align: left;
		padding: 5px 10px;
		background: var(--th-bg);
		color: var(--th-text);
		border-bottom: 1px solid var(--border);
	}
	.pen-table td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}
	.pen-table tr:hover td {
		background: var(--hover-bg);
	}
	.pen-table a {
		color: var(--link);
		text-decoration: none;
	}
	.pen-table a:hover {
		text-decoration: underline;
	}
	.year {
		color: var(--text-muted);
		width: 60px;
	}
</style>
