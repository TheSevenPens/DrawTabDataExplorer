<script lang="ts">
	// Every external reference link across all tablet entities, in one filterable
	// table. Rows are built in the route load (buildTabletLinkRows). Filters are
	// client-side: search by tablet name, plus brand and type dropdowns.
	import EntityLink from '$lib/components/EntityLink.svelte';
	import type { TabletLinkRow } from '$lib/reference/tablet-links.js';

	let { links }: { links: TabletLinkRow[] } = $props();

	const TYPE_LABEL: Record<string, string> = {
		REVIEW: 'review',
		PRODUCTINFO: 'product',
		USERMANUAL: 'manual',
		STORE: 'store',
	};
	const TYPE_RANK: Record<string, number> = { REVIEW: 0, PRODUCTINFO: 1, USERMANUAL: 2, STORE: 3 };

	// --- Filters (client-side) ---
	let search = $state('');
	let brand = $state('');
	let type = $state('');

	// Distinct brands (by code, label from the row) for the dropdown.
	const brands = $derived(
		[...new Map(links.map((l) => [l.brand, l.brandName])).entries()].sort((a, b) =>
			a[1].localeCompare(b[1]),
		),
	);
	const types = $derived(
		[...new Set(links.map((l) => l.type))].sort(
			(a, b) => (TYPE_RANK[a] ?? 9) - (TYPE_RANK[b] ?? 9),
		),
	);

	const filtered = $derived(
		links.filter(
			(l) =>
				(brand === '' || l.brand === brand) &&
				(type === '' || l.type === type) &&
				(search === '' || l.tabletFullName.toLowerCase().includes(search.toLowerCase())),
		),
	);

	function hostOf(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}
</script>

<section>
	<div class="section-header">
		<h2>Tablet Links</h2>
	</div>
	<p class="meta">
		Every external reference link (reviews, product pages, manuals, store) across all tablet
		entities. Curate them on the
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="/links-review">links review page →</a>.
	</p>

	{#if links.length}
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
					<option value={t}>{TYPE_LABEL[t] ?? t}</option>
				{/each}
			</select>
			<span class="filter-count">{filtered.length} of {links.length}</span>
		</div>
		<div class="table-wrap">
			<table class="ref-table">
				<thead>
					<tr>
						<th>Type</th>
						<th>Title</th>
						<th>Tablet</th>
						<th>Brand</th>
						<th>Author</th>
						<th>Date</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as l (l.tabletEntityId + '|' + l.url)}
						<tr>
							<td><span class="badge">{TYPE_LABEL[l.type] ?? l.type}</span></td>
							<td class="title-cell">
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={l.url} target="_blank" rel="noopener">{l.title || hostOf(l.url)}</a>
							</td>
							<td><EntityLink entityId={l.tabletEntityId}>{l.tabletLabel}</EntityLink></td>
							<td class="dim">{l.brandName}</td>
							<td class="dim">{l.author || '—'}</td>
							<td class="dim mono">{l.publishDate || '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="meta">No tablet links yet.</p>
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
	.title-cell {
		white-space: normal;
		max-width: 460px;
	}
	.dim {
		color: var(--text-muted);
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.badge {
		display: inline-block;
		padding: 1px 6px;
		font-size: var(--type-micro);
		letter-spacing: var(--track-wide);
		text-transform: uppercase;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text-muted);
	}
</style>
