<script lang="ts">
	import { base } from '$app/paths';
	import { brandName } from '$data/lib/drawtab-loader.js';
	import type { Pen, PressureResponse } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import {
		type PenFamily,
		PEN_FAMILY_FIELDS,
		PEN_FAMILY_FIELD_GROUPS,
	} from '$data/lib/entities/pen-family-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import PressureChart from '$lib/components/PressureChart.svelte';
	import SessionStats from '$lib/components/SessionStats.svelte';
	import ChartLegendTable from '$lib/components/ChartLegendTable.svelte';
	import FlagButton from '$lib/components/FlagButton.svelte';
	import { flaggedPenFamilies, toggleFlaggedPenFamily } from '$lib/flagged-store.js';
	import { paletteColor } from '$lib/chart-palette.js';
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
	let penLabelById = $derived(
		new Map(
			memberPens.map((p) => [
				p.EntityId,
				p.PenName === p.PenId ? p.PenId : `${p.PenName} (${p.PenId})`,
			]),
		),
	);

	let sessionColors = $derived(new Map(pressureSessions.map((s, i) => [s._id, paletteColor(i)])));

	let chartSessions = $derived(
		pressureSessions.map((s) => {
			const info = defectsByInventoryId.get(s.InventoryId);
			return {
				id: s._id,
				label: `${penLabelById.get(s.PenEntityId) ?? s.PenEntityId} · ${s.InventoryId} ${s.Date}`,
				records: s.Records,
				color: sessionColors.get(s._id),
				defective: !!info,
				defectInfo: info?.detailsLabel,
			};
		}),
	);

	let hiddenSessionIds = $state(new Set<string>());

	function toggleSessionVisibility(id: string) {
		const next = new Set(hiddenSessionIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		hiddenSessionIds = next;
	}
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
<DetailView item={family} fields={PEN_FAMILY_FIELDS} fieldGroups={PEN_FAMILY_FIELD_GROUPS} />

<section class="members">
	<h2>Pens in this family ({memberPens.length})</h2>
	{#if memberPens.length > 0}
		<table class="pen-table">
			<thead>
				<tr><th>Name</th><th>Year</th></tr>
			</thead>
			<tbody>
				{#each memberPens as p}
					<tr>
						<td>
							<a href="{base}/entity/{encodeURIComponent(p.EntityId)}">
								{brandName(p.Brand)}
								{p.PenName}
								{#if p.PenName !== p.PenId}<span class="dim">({p.PenId})</span>{/if}
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
</section>

<section class="pressure">
	<h2>Pressure Response ({pressureSessions.length})</h2>
	{#if pressureSessions.length > 0}
		<PressureChart
			sessions={chartSessions}
			title={`${family.FamilyName} pressure response`}
			hiddenIds={hiddenSessionIds}
		/>
		<ChartLegendTable
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
</section>

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
	.members,
	.pressure {
		margin-top: 24px;
	}
	.members h2,
	.pressure h2 {
		font-size: 16px;
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
