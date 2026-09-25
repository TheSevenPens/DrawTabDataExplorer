<script lang="ts">
	import { brandName, type Tablet } from '$data/lib/drawtab-loader.js';
	import { tabletFullName } from '$lib/tablet-helpers.js';
	import { compileSearch } from '$lib/search-match.js';
	import { toggleFlag } from '$lib/flagged-store.js';
	import PickerModalShell from '$lib/components/PickerModalShell.svelte';
	import { onMount } from 'svelte';
	import Button from './Button.svelte';

	interface Props {
		allTablets: Tablet[];
		flaggedIds: string[];
		onclose: () => void;
	}

	let { allTablets, flaggedIds, onclose }: Props = $props();

	let searchText = $state('');
	let filterBrand = $state('');
	let filterType = $state('');
	let searchInput: HTMLInputElement | undefined = $state();

	onMount(() => {
		// Focus the search input when the picker opens. Programmatic focus
		// avoids the autofocus attribute, which is flagged by a11y rules
		// because it can disorient screen-reader users when an element
		// grabs focus unexpectedly.
		searchInput?.focus();
	});

	let brands = $derived([...new Set(allTablets.map((t) => t.Model.Brand))].sort());

	let filteredTablets = $derived.by(() => {
		const search = compileSearch(searchText);
		return allTablets.filter((t) => {
			if (filterBrand && t.Model.Brand !== filterBrand) return false;
			if (filterType && t.Model.Type !== filterType) return false;
			if (search) {
				const altNames = t.Model.AlternateNames ?? [];
				// Exact check on the joined text, as before; the separator-
				// insensitive check on each value separately (#327).
				const exact = search.exact(`${tabletFullName(t)} ${altNames.join(' ')}`);
				const candidates = [tabletFullName(t), t.Model.Id, t.Model.Name, ...altNames];
				if (!exact && !candidates.some((c) => search.stripped(c))) return false;
			}
			return true;
		});
	});

	function typeLabel(type: string) {
		if (type === 'PENTABLET') return 'Pen Tablet';
		if (type === 'PENDISPLAY') return 'Pen Display';
		if (type === 'STANDALONE') return 'Standalone';
		return type;
	}
</script>

<!-- Flags are an inbox for Compare, not its columns, so there is no cap (#373). -->
<PickerModalShell title="Flag Tablets" {onclose}>
	{#snippet headerAccessory()}
		<span class="slot-count">{flaggedIds.length} flagged</span>
	{/snippet}

	<div class="filters">
		<input
			bind:this={searchInput}
			type="search"
			class="search-input"
			placeholder="Search brand, name, or ID…"
			bind:value={searchText}
		/>
		<select bind:value={filterBrand}>
			<option value="">All Brands</option>
			{#each brands as b (b)}
				<option value={b}>{brandName(b)}</option>
			{/each}
		</select>
		<select bind:value={filterType}>
			<option value="">All Types</option>
			<option value="PENTABLET">Pen Tablet</option>
			<option value="PENDISPLAY">Pen Display</option>
			<option value="STANDALONE">Standalone</option>
		</select>
	</div>

	<div class="results-count">
		{filteredTablets.length} tablet{filteredTablets.length === 1 ? '' : 's'}
	</div>

	<ul class="tablet-list" role="list">
		{#each filteredTablets as t (t.Meta.EntityId)}
			{@const alreadyAdded = flaggedIds.includes(t.Meta.EntityId)}
			<li class:added={alreadyAdded} role="listitem">
				<div class="tablet-info">
					<span class="tablet-brand">{brandName(t.Model.Brand)}</span>
					<span class="tablet-name">{t.Model.Name}</span>
					<span class="tablet-id">{t.Model.Id}</span>
				</div>
				<span class="type-badge type-{t.Model.Type.toLowerCase()}">{typeLabel(t.Model.Type)}</span>
				{#if alreadyAdded}
					<span class="added-status">✓ Added</span>
				{:else}
					<Button
						variant="secondary"
						onclick={() => toggleFlag(t.Meta.EntityId)}
						title={`Add ${t.Model.Name}`}>+ Add</Button
					>
				{/if}
			</li>
		{/each}
		{#if filteredTablets.length === 0}
			<li class="empty" role="listitem">No tablets match your search.</li>
		{/if}
	</ul>
</PickerModalShell>

<style>
	.slot-count {
		font-size: var(--type-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		color: var(--text-muted);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 2px 8px;
	}

	.filters {
		display: flex;
		gap: 8px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text);
		min-width: 0;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent);
	}

	.filters select {
		padding: 5px 8px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text);
		flex-shrink: 0;
	}

	.results-count {
		font-size: 11px;
		color: var(--text-dim);
		padding: 4px 16px 2px;
		flex-shrink: 0;
	}

	.tablet-list {
		list-style: none;
		padding: 4px 0;
		margin: 0;
		overflow-y: auto;
		flex: 1;
	}

	.tablet-list li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 16px;
		border-bottom: 1px solid var(--border-light);
	}

	.tablet-list li:last-child {
		border-bottom: none;
	}

	.tablet-list li.added {
		background: var(--bg-card);
		opacity: 0.6;
	}

	.tablet-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.tablet-brand {
		font-size: 11px;
		color: var(--text-dim);
	}

	.tablet-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tablet-id {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
	}

	/*
	 * The badge prints typeLabel() as its text, so the old blue / purple /
	 * green fills per type restated the word inside them. One neutral
	 * outline now; the label carries the meaning.
	 */
	.type-badge {
		font-size: var(--type-micro);
		font-weight: 600;
		padding: 2px 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text-muted);
		background: transparent;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* Status, not a command: the row is already in the comparison. Sized like
	   the "+ Add" Button beside it so the rows stay one height. */
	.added-status {
		flex-shrink: 0;
		/* Button size sm metrics, so both controls are the same height. */
		padding: 4px 9px;
		line-height: 1;
		font-size: var(--type-micro);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		border: 1px solid var(--good);
		color: var(--good);
		opacity: 0.5;
		white-space: nowrap;
	}

	.empty {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
		padding: 16px;
		text-align: center;
	}
</style>
