<script lang="ts">
	// Mirror of TabletPicker, scoped to pen models. No cap (unlike tablets):
	// pen flags also drive the /pen-flagged pressure-overlay chart which
	// benefits from many flags, so capping in the store would hurt that
	// workflow. The picker shows a flagged-count badge but the Add button
	// stays enabled.
	import { brandName, type Pen } from '$data/lib/drawtab-loader.js';
	import { penBrandAndName } from '$lib/pen-helpers.js';
	import { toggleFlaggedPenModel } from '$lib/flagged-store.js';
	import PickerModalShell from '$lib/components/PickerModalShell.svelte';
	import { onMount } from 'svelte';

	interface Props {
		allPens: Pen[];
		flaggedIds: string[];
		onclose: () => void;
	}

	let { allPens, flaggedIds, onclose }: Props = $props();

	let searchText = $state('');
	let filterBrand = $state('');
	let searchInput: HTMLInputElement | undefined = $state();

	onMount(() => {
		searchInput?.focus();
	});

	let brands = $derived([...new Set(allPens.map((p) => p.Brand))].sort());

	let filteredPens = $derived.by(() => {
		const q = searchText.trim().toLowerCase();
		return allPens.filter((p) => {
			if (filterBrand && p.Brand !== filterBrand) return false;
			if (q) {
				const hay = `${penBrandAndName(p)} ${p.PenId} ${p.EntityId}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	});

	// Comparison uses the lowercase EntityId (matches the flag store's
	// normalization in toggleFlaggedPenModel).
	let flaggedIdSet = $derived(new Set(flaggedIds.map((id) => id.toLowerCase())));
</script>

<PickerModalShell title="Add Pen" {onclose}>
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
	</div>

	<div class="results-count">
		{filteredPens.length} pen{filteredPens.length === 1 ? '' : 's'}
	</div>

	<ul class="pen-list" role="list">
		{#each filteredPens as p (p.EntityId)}
			{@const alreadyAdded = flaggedIdSet.has(p.EntityId.toLowerCase())}
			<li class:added={alreadyAdded} role="listitem">
				<div class="pen-info">
					<span class="pen-brand">{brandName(p.Brand)}</span>
					<span class="pen-name">{p.PenName}</span>
					<span class="pen-id">{p.PenId}</span>
				</div>
				{#if alreadyAdded}
					<button class="add-btn is-added" disabled>✓ Added</button>
				{:else}
					<button
						class="add-btn"
						onclick={() => toggleFlaggedPenModel(p.EntityId)}
						title={`Add ${p.PenName}`}>+ Add</button
					>
				{/if}
			</li>
		{/each}
		{#if filteredPens.length === 0}
			<li class="empty" role="listitem">No pens match your search.</li>
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

	.pen-list {
		list-style: none;
		padding: 4px 0;
		margin: 0;
		overflow-y: auto;
		flex: 1;
	}

	.pen-list li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 7px 16px;
		border-bottom: 1px solid var(--border-light);
	}

	.pen-list li:last-child {
		border-bottom: none;
	}

	.pen-list li.added {
		background: var(--bg-card);
		opacity: 0.6;
	}

	.pen-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.pen-brand {
		font-size: 11px;
		color: var(--text-dim);
	}

	.pen-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pen-id {
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
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
</style>
