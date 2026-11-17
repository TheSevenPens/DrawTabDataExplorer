<script lang="ts">
	import { resolve } from '$app/paths';
	import { brandName } from '$data/lib/drawtab-loader.js';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import {
		RANK_COUNT_OPTIONS,
		rankMetric,
		type RankDirection,
		type RankFilter,
	} from '$lib/tablet-analysis/metric-tabs.js';
	import type { RankedMetric } from '$lib/tablet-analysis/RankedMetricSection.svelte';
	import TypeBrandSelects from '$lib/tablet-analysis/TypeBrandSelects.svelte';

	let {
		metric,
		direction,
		filter = $bindable(),
	}: {
		metric: RankedMetric;
		direction: RankDirection;
		filter: RankFilter;
	} = $props();

	let rows = $derived(rankMetric(metric.rows, direction, filter));
	let title = $derived(`${direction === 'lowest' ? 'Lowest' : 'Highest'} ${metric.title}`);
	let filename = $derived(`analysis-${metric.id}-${direction}`);
</script>

<p class="description">{metric.description}</p>
{#if metric.rows.length === 0}
	<EmptyState>{metric.emptyText}</EmptyState>
{:else}
	<div class="rank-controls">
		<div class="controls-left">
			<TypeBrandSelects
				types={metric.types}
				type={filter.type}
				onTypeChange={(t) => (filter = { ...filter, type: t })}
				brands={metric.brands}
				brand={filter.brand}
				onBrandChange={(b) => (filter = { ...filter, brand: b })}
			/>
			<label class="show-count">
				Show
				<select onchange={(e) => (filter = { ...filter, count: Number(e.currentTarget.value) })}>
					{#each RANK_COUNT_OPTIONS as n (n)}
						<option value={n} selected={filter.count === n}>{n}</option>
					{/each}
				</select>
			</label>
		</div>
		<ExportTableButton
			entityType="analysis"
			{title}
			{filename}
			headers={['Rank', 'Tablet', 'Brand', 'Year', `${metric.valueLabel} (${metric.unit})`]}
			rows={rows.map((r, i) => [
				i + 1,
				`${r.name} (${r.id})`,
				brandName(r.brand),
				r.year,
				metric.format(r.value),
			])}
		/>
	</div>
	{#if rows.length === 0}
		<EmptyState>No tablets match {metric.types ? 'these filters' : 'this brand'}.</EmptyState>
	{:else}
		<table class="rank-table">
			<thead>
				<tr>
					<th class="num">#</th>
					<th>Tablet</th>
					<th>Brand</th>
					<th class="num">Year</th>
					<th class="num">{metric.valueLabel} <span class="unit">({metric.unit})</span></th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r, i (r.entityId)}
					<tr>
						<td class="num mono">{i + 1}</td>
						<td>
							<a href={resolve('/entity/[entityId]', { entityId: r.entityId })}>
								{r.name} ({r.id})
							</a>
						</td>
						<td>{brandName(r.brand)}</td>
						<td class="num mono">{r.year || '—'}</td>
						<td class="num mono">{metric.format(r.value)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
{/if}
