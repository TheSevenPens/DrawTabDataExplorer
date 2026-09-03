<script lang="ts">
	import { resolve } from '$app/paths';
	import DistributionTable from '$lib/components/DistributionTable.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import TableFrame from '$lib/components/TableFrame.svelte';
	import AnalysisExportRow from '$lib/tablet-analysis/AnalysisExportRow.svelte';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import {
		TABLET_TYPE_OPTIONS,
		type TabletTypeValue,
		type TouchTabletRow,
	} from '$lib/tablet-analysis/helpers.js';
	import { brandName } from '$data/lib/drawtab-loader.js';

	type Row = { label: string; count: number };

	let {
		rows,
		total,
		coveredOf,
		onExport,
		touchRows,
		selectedTypes = $bindable(),
	}: {
		rows: Row[];
		total: number;
		coveredOf: number;
		onExport: () => void;
		/** Tablets reporting touch support, already limited to `selectedTypes`. */
		touchRows: TouchTabletRow[];
		selectedTypes: Set<TabletTypeValue>;
	} = $props();

	// Reassign rather than mutate — that is what drives Svelte 5 reactivity here
	// (see CLAUDE.md § reactive Set/Map state).
	function toggleType(value: TabletTypeValue) {
		const next = new Set(selectedTypes);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		selectedTypes = next;
	}
</script>

<h2>Touch Support</h2>
<p class="description">Distribution of {coveredOf} tablets by digitizer touch support.</p>
<AnalysisExportRow disabled={rows.length === 0} onclick={onExport} />
<DistributionTable labelHeader="Touch" {rows} {total} />

<div class="touch-list">
	<TableFrame title="Tablets with touch support" count={touchRows.length}>
		{#snippet actions()}
			<ExportTableButton
				entityType="analysis"
				title="Tablets with touch support"
				filename="analysis-touch-support-tablets"
				headers={['Tablet', 'Brand', 'Type', 'Year']}
				rows={touchRows.map((r) => [
					`${r.name} (${r.id})`,
					brandName(r.brand),
					r.typeLabel,
					r.year,
				])}
				disabled={touchRows.length === 0}
			/>
		{/snippet}

		<div class="type-filter" role="group" aria-label="Device types">
			<span class="type-filter-legend">Device types</span>
			{#each TABLET_TYPE_OPTIONS as opt (opt.value)}
				<label>
					<input
						type="checkbox"
						checked={selectedTypes.has(opt.value)}
						onchange={() => toggleType(opt.value)}
					/>
					{opt.label}
				</label>
			{/each}
		</div>

		{#if selectedTypes.size === 0}
			<EmptyState>Select at least one device type.</EmptyState>
		{:else if touchRows.length === 0}
			<EmptyState>No tablets of the selected types report touch support.</EmptyState>
		{:else}
			<table>
				<thead>
					<tr>
						<th>Tablet</th>
						<th>Brand</th>
						<th>Type</th>
						<th class="num">Year</th>
					</tr>
				</thead>
				<tbody>
					{#each touchRows as r (r.entityId)}
						<tr>
							<td>
								<a href={resolve('/entity/[entityId]', { entityId: r.entityId })}>
									{r.name} ({r.id})
								</a>
							</td>
							<td>{brandName(r.brand)}</td>
							<td>{r.typeLabel}</td>
							<td class="num mono">{r.year || '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</TableFrame>
</div>

<style>
	.touch-list {
		margin-top: 28px;
	}

	.type-filter {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 16px;
		margin: 0 0 10px;
	}

	.type-filter-legend {
		font-size: var(--type-caption);
		color: var(--text-muted);
	}

	.type-filter label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: var(--type-caption);
		color: var(--text);
		cursor: pointer;
	}

	.type-filter input {
		accent-color: var(--accent);
		cursor: pointer;
	}
</style>
