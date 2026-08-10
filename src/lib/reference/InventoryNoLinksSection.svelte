<script lang="ts">
	// Tablets that are in the inventory but have no reference links yet — a
	// curation gap list. Rows are built in the route load
	// (buildInventoryTabletsWithoutLinksRows). Filters are client-side: search by
	// tablet name, plus brand and (tablet) type dropdowns. Columns are sortable.
	import EntityLink from '$lib/components/EntityLink.svelte';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import { sortRows, type SortDir } from '$lib/components/sortable-table.js';
	import type { InventoryNoLinksRow } from '$lib/reference/inventory-no-links.js';

	let { rows }: { rows: InventoryNoLinksRow[] } = $props();

	// --- Filters (client-side) ---
	let search = $state('');
	let brand = $state('');
	let type = $state('');

	const brands = $derived(
		[...new Map(rows.map((r) => [r.brand, r.brandName])).entries()].sort((a, b) =>
			a[1].localeCompare(b[1]),
		),
	);
	const types = $derived([...new Set(rows.map((r) => r.type))].sort());

	const filtered = $derived(
		rows.filter(
			(r) =>
				(brand === '' || r.brand === brand) &&
				(type === '' || r.type === type) &&
				(search === '' || r.tabletFullName.toLowerCase().includes(search.toLowerCase())),
		),
	);

	// --- Sorting (clickable headers) ---
	const SORT_ACCESSORS: Record<string, (r: InventoryNoLinksRow) => string | number> = {
		tablet: (r) => r.tabletLabel.toLowerCase(),
		brand: (r) => r.brandName.toLowerCase(),
		type: (r) => r.type,
		year: (r) => r.year,
		units: (r) => r.units,
	};
	let sortKey = $state('');
	let sortDir = $state<SortDir>('asc');
	function sortBy(key: string) {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortKey = key;
			sortDir = 'asc';
		}
	}
	const sorted = $derived(
		sortKey ? sortRows(filtered, SORT_ACCESSORS[sortKey], sortDir) : filtered,
	);

	const exportHeaders = ['Tablet', 'Brand', 'Type', 'Year', 'Units', 'EntityId'];
	const exportRows = $derived(
		sorted.map((r) => [r.tabletLabel, r.brandName, r.type, r.year, r.units, r.tabletEntityId]),
	);
</script>

<section>
	<div class="section-header">
		<h2>Inventory Missing Links</h2>
	</div>
	<p class="meta">
		Tablets you own (at least one inventory unit) that have no reference links yet — the gap to fill
		on the
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="/links-review">links review page →</a>.
	</p>

	{#if rows.length}
		{#snippet sortHeader(key: string, label: string, num = false)}
			<th
				class="sortable"
				class:num
				aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
				onclick={() => sortBy(key)}
			>
				{label}{#if sortKey === key}<span class="arrow">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span
					>{/if}
			</th>
		{/snippet}
		<div class="ref-filters">
			<input type="search" placeholder="Search tablet name…" bind:value={search} />
			<select bind:value={brand} aria-label="Filter by brand">
				<option value="">All brands</option>
				{#each brands as [code, label] (code)}
					<option value={code}>{label}</option>
				{/each}
			</select>
			<select bind:value={type} aria-label="Filter by type">
				<option value="">All types</option>
				{#each types as t (t)}
					<option value={t}>{t}</option>
				{/each}
			</select>
			<span class="filter-count">{filtered.length} of {rows.length}</span>
			<span class="export-slot">
				<ExportTableButton
					entityType="reference"
					title="Inventory Missing Links"
					filename="inventory-missing-links"
					headers={exportHeaders}
					rows={exportRows}
				/>
			</span>
		</div>
		<div class="table-wrap">
			<table class="ref-table">
				<thead>
					<tr>
						{@render sortHeader('tablet', 'Tablet')}
						{@render sortHeader('brand', 'Brand')}
						{@render sortHeader('type', 'Type')}
						{@render sortHeader('year', 'Year', true)}
						{@render sortHeader('units', 'Units', true)}
					</tr>
				</thead>
				<tbody>
					{#each sorted as r (r.tabletEntityId)}
						<tr>
							<td><EntityLink entityId={r.tabletEntityId}>{r.tabletLabel}</EntityLink></td>
							<td class="dim">{r.brandName}</td>
							<td class="dim">{r.type}</td>
							<td class="dim num">{r.year}</td>
							<td class="num">{r.units}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="meta">Every inventory tablet has at least one link. 🎉</p>
	{/if}
</section>

<style>
	.section-header {
		margin-bottom: 8px;
	}
	h2 {
		font-size: var(--type-heading);
		font-weight: 600;
		color: var(--text);
	}
	.meta {
		margin: 0 0 6px;
		color: var(--text-muted);
		font-size: var(--type-caption);
	}
	.table-wrap {
		overflow-x: auto;
		margin-top: 8px;
	}
	.export-slot {
		margin-left: auto;
	}
	.dim {
		color: var(--text-muted);
	}
	.num {
		text-align: right;
	}
	th.sortable {
		cursor: pointer;
		user-select: none;
	}
	th.sortable:hover {
		color: var(--text);
	}
	.arrow {
		font-size: 10px;
	}
</style>
