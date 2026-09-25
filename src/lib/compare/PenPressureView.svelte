<script lang="ts">
	// Compare "pressure response" for pens (#373). Pooled (default): one series
	// per column — every session in the column drawn in the column's colour,
	// so a group reads as one cluster of curves. Split: the sessions drawn once
	// each, coloured per pen model, with the usual per-session legend table.
	//
	// The group table below is the pooled chart's legend: it names each series
	// (the palette leans on that — see chart-palette.ts) and summarises it.
	// True per-group envelope bands need a PressureResponseChart change; that
	// is a follow-up.
	import type { Pen, PressureResponse, PressureRange } from '$data/lib/drawtab-loader.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';
	import { fmtP } from '$data/lib/pressure/interpolate.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import PressureResponseChart from '$lib/components/PressureResponseChart.svelte';
	import PressureResponseChartLegendTable from '$lib/components/PressureResponseChartLegendTable.svelte';
	import { buildSessionColorsBy, type ChartSession } from '$lib/pressure/chart-session-state.js';
	import { theme } from '$lib/theme-store.js';
	import { columnMeasurements, columnSessions, penGroupStats } from './pen-groups';
	import type { ResolvedColumn } from './resolve';

	let {
		columns,
		colors,
		sessions,
		measurements,
		defectsByInventoryId,
		penNameById,
		tabletNameById,
	}: {
		columns: ResolvedColumn<Pen>[];
		colors: string[];
		sessions: PressureResponse[];
		/** IAF and MAX direct measurements. */
		measurements: PressureRange[];
		defectsByInventoryId: ReadonlyMap<string, DefectInfo>;
		penNameById: ReadonlyMap<string, string>;
		tabletNameById: ReadonlyMap<string, string>;
	} = $props();

	let mode: 'pooled' | 'split' = $state('pooled');

	let groups = $derived(
		columns.map((col, i) => {
			const s = columnSessions(col, sessions);
			return {
				col,
				color: colors[i],
				sessions: s,
				stats: penGroupStats(s, columnMeasurements(col, measurements), defectsByInventoryId),
			};
		}),
	);

	// Pooled: a session in two columns is drawn in both, so ids carry the column.
	let hiddenColumns = $state(new Set<string>());
	let pooledSessions: ChartSession[] = $derived(
		groups.flatMap((g) =>
			g.sessions.map((s) => {
				const info = defectsByInventoryId.get(s.InventoryId);
				return {
					id: `${g.col.id}|${s._id}`,
					label: `${g.col.name} · ${s.InventoryId} ${s.Date}`,
					records: s.Records,
					color: g.color,
					defective: !!info,
					defectInfo: info?.detailsLabel,
				};
			}),
		),
	);
	let pooledHidden = $derived(
		new Set(pooledSessions.filter((s) => hiddenColumns.has(s.id.split('|')[0])).map((s) => s.id)),
	);
	function toggleColumn(id: string) {
		const next = new Set(hiddenColumns);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		hiddenColumns = next;
	}

	// Split: each session once, coloured by pen model.
	let distinctSessions = $derived([
		...new Map(groups.flatMap((g) => g.sessions).map((s) => [s._id, s])).values(),
	]);
	let splitColors = $derived(buildSessionColorsBy(distinctSessions, 'model', $theme));
	let splitSessions: ChartSession[] = $derived(
		distinctSessions.map((s) => {
			const info = defectsByInventoryId.get(s.InventoryId);
			return {
				id: s._id,
				label: `${penNameById.get(s.PenEntityId) ?? s.PenEntityId} · ${s.InventoryId} ${s.Date}`,
				records: s.Records,
				color: splitColors.get(s._id),
				defective: !!info,
				defectInfo: info?.detailsLabel,
			};
		}),
	);
	let splitHidden = $state(new Set<string>());
	function toggleSession(id: string) {
		const next = new Set(splitHidden);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		splitHidden = next;
	}
</script>

{#if distinctSessions.length === 0}
	<EmptyState>None of the compared pens has pressure-response sessions yet.</EmptyState>
{:else}
	<div class="bar">
		<SegmentedControl
			ariaLabel="Series"
			options={[
				{ value: 'pooled', label: 'one series per column' },
				{ value: 'split', label: 'split into pens' },
			]}
			bind:value={mode}
		/>
	</div>

	{#if mode === 'pooled'}
		<PressureResponseChart
			sessions={pooledSessions}
			title="Compared pens"
			hiddenIds={pooledHidden}
		/>
	{:else}
		<PressureResponseChart sessions={splitSessions} title="Compared pens" hiddenIds={splitHidden} />
	{/if}

	<div class="table-wrap">
		<table class="groups">
			<thead>
				<tr>
					<th>Column</th>
					<th class="num">Pens measured</th>
					<th class="num">Sessions</th>
					<th class="num">Median IAF <span class="unit">(gf)</span></th>
					<th class="num">Median MAX <span class="unit">(gf)</span></th>
				</tr>
			</thead>
			<tbody>
				{#each groups as g (g.col.id)}
					<tr class:hidden={mode === 'pooled' && hiddenColumns.has(g.col.id)}>
						<td>
							{#if mode === 'pooled'}
								<label class="series">
									<input
										type="checkbox"
										checked={!hiddenColumns.has(g.col.id)}
										onchange={() => toggleColumn(g.col.id)}
										aria-label="Show {g.col.name}"
									/>
									<span class="swatch" style:background={g.color} aria-hidden="true"></span>
									{g.col.name}
								</label>
							{:else}
								{g.col.name}
							{/if}
						</td>
						<td class="num mono">{g.stats.pensMeasured} of {g.col.models.length}</td>
						<td class="num mono">{g.stats.sessions}</td>
						<td class="num mono">{fmtP(g.stats.iaf)}</td>
						<td class="num mono">{fmtP(g.stats.max)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="note">
		Medians are across pen units, not sessions: a unit with direct measurements uses them, otherwise
		its sessions' estimates. Defective units are left out.
	</p>

	{#if mode === 'split'}
		<PressureResponseChartLegendTable
			sessions={distinctSessions}
			colors={splitColors}
			hiddenIds={splitHidden}
			onToggle={toggleSession}
			{penNameById}
			{tabletNameById}
			{defectsByInventoryId}
			showBrand
			showModel
		/>
	{/if}
{/if}

<style>
	.bar {
		margin-bottom: 10px;
	}

	.table-wrap {
		overflow-x: auto;
		margin-top: 14px;
	}

	.num {
		text-align: right;
	}

	.mono {
		font-variant-numeric: tabular-nums;
	}

	.unit {
		color: var(--text-dim);
		font-weight: 400;
	}

	.series {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}

	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		margin-right: 4px;
		vertical-align: baseline;
	}

	tr.hidden td {
		color: var(--text-dim);
	}

	.note {
		font-size: var(--type-caption);
		color: var(--text-dim);
		margin: 8px 0 16px 0;
	}
</style>
