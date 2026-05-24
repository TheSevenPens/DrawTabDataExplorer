<script lang="ts">
	// Mirror of TabletPicker, scoped to pen models. No cap (unlike tablets):
	// pen flags also drive the /pen-flagged pressure-overlay chart which
	// benefits from many flags, so capping in the store would hurt that
	// workflow. The picker shows a flagged-count badge but the Add button
	// stays enabled.
	import { brandName, type Pen } from '$data/lib/drawtab-loader.js';
	import { penBrandAndName } from '$lib/pen-helpers.js';
	import { toggleFlaggedPenModel } from '$lib/flagged-store.js';
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

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onBackdropClick}>
	<div class="modal" role="dialog" aria-modal="true" aria-label="Add pen" tabindex="-1">
		<div class="modal-header">
			<h2>Add Pen</h2>
			<span class="slot-count">{flaggedIds.length} flagged</span>
			<button class="close-btn" onclick={onclose} aria-label="Close">✕</button>
		</div>

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
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
	}

	.modal {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		width: min(640px, 95vw);
		max-height: min(600px, 90vh);
		display: flex;
		flex-direction: column;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
	}

	.modal-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px 12px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
		color: var(--text);
		flex: 1;
	}

	.slot-count {
		font-size: 12px;
		color: var(--text-muted);
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 10px;
		padding: 2px 8px;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 16px;
		color: var(--text-muted);
		padding: 2px 6px;
		border-radius: 4px;
		line-height: 1;
	}

	.close-btn:hover {
		background: var(--hover-bg);
		color: var(--text);
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
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
		min-width: 0;
	}

	.search-input:focus {
		outline: none;
		border-color: #2563eb;
	}

	.filters select {
		padding: 5px 8px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
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
		font-size: 12px;
		font-weight: 600;
		border-radius: 4px;
		border: 1px solid #2563eb;
		background: var(--bg-card);
		color: #2563eb;
		cursor: pointer;
		white-space: nowrap;
	}

	.add-btn:hover:not(:disabled) {
		background: #2563eb;
		color: #fff;
	}

	.add-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.add-btn.is-added {
		border-color: #16a34a;
		color: #16a34a;
	}

	.empty {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
		padding: 16px;
		text-align: center;
	}
</style>
