<script lang="ts">
	import { brandName, type Tablet } from '$data/lib/drawtab-loader.js';
	import { tabletFullName } from '$lib/tablet-helpers.js';
	import { toggleFlag } from '$lib/flagged-store.js';
	import PickerModalShell from '$lib/components/PickerModalShell.svelte';
	import { onMount } from 'svelte';

	interface Props {
		allTablets: Tablet[];
		flaggedIds: string[];
		onclose: () => void;
	}

	let { allTablets, flaggedIds, onclose }: Props = $props();

	const MAX_FLAGGED = 6;

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
		const q = searchText.trim().toLowerCase();
		return allTablets.filter((t) => {
			if (filterBrand && t.Model.Brand !== filterBrand) return false;
			if (filterType && t.Model.Type !== filterType) return false;
			if (q) {
				const altNames = (t.Model.AlternateNames ?? []).join(' ');
				const hay = `${tabletFullName(t)} ${altNames}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	});

	let isFull = $derived(flaggedIds.length >= MAX_FLAGGED);

	function typeLabel(type: string) {
		if (type === 'PENTABLET') return 'Pen Tablet';
		if (type === 'PENDISPLAY') return 'Pen Display';
		if (type === 'STANDALONE') return 'Standalone';
		return type;
	}
</script>

<PickerModalShell title="Add Tablet" {onclose}>
	{#snippet headerAccessory()}
		<span class="slot-count" class:full={isFull}>{flaggedIds.length}/{MAX_FLAGGED} slots used</span>
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
					<button class="add-btn is-added" disabled>✓ Added</button>
				{:else}
					<button
						class="add-btn"
						disabled={isFull}
						onclick={() => toggleFlag(t.Meta.EntityId)}
						title={isFull ? 'Maximum 6 tablets reached' : `Add ${t.Model.Name}`}>+ Add</button
					>
				{/if}
			</li>
		{/each}
		{#if filteredTablets.length === 0}
			<li class="empty" role="listitem">No tablets match your search.</li>
		{/if}
	</ul>

	{#snippet footer()}
		{#if isFull}
			<p class="full-notice">All 6 slots are used. Unflag a tablet to make room.</p>
		{/if}
	{/snippet}
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

	.slot-count.full {
		color: var(--danger);
		border-color: var(--danger);
		background: transparent;
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

	.add-btn {
		flex-shrink: 0;
		padding: 4px 12px;
		font-size: var(--type-micro);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		border-radius: var(--radius);
		border: 1px solid var(--accent);
		background: transparent;
		color: var(--accent);
		cursor: pointer;
		white-space: nowrap;
	}

	.add-btn:hover:not(:disabled) {
		background: var(--accent);
		color: var(--accent-contrast);
	}

	.add-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.add-btn.is-added {
		border-color: var(--good);
		color: var(--good);
	}

	.empty {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
		padding: 16px;
		text-align: center;
	}

	.full-notice {
		font-size: 12px;
		color: var(--danger);
		text-align: center;
		padding: 8px 16px;
		margin: 0;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}
</style>
