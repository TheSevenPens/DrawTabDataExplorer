<script lang="ts">
	import { brandName, type Tablet } from '$data/lib/drawtab-loader.js';
	import { toggleFlag } from '$lib/flagged-store.js';

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

	let brands = $derived(
		[...new Set(allTablets.map((t) => t.Model.Brand))].sort()
	);

	let filteredTablets = $derived.by(() => {
		const q = searchText.trim().toLowerCase();
		return allTablets.filter((t) => {
			if (filterBrand && t.Model.Brand !== filterBrand) return false;
			if (filterType && t.Model.Type !== filterType) return false;
			if (q) {
				const hay = `${brandName(t.Model.Brand)} ${t.Model.Name} ${t.Model.Id}`.toLowerCase();
				if (!hay.includes(q)) return false;
			}
			return true;
		});
	});

	let isFull = $derived(flaggedIds.length >= MAX_FLAGGED);

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function typeLabel(type: string) {
		if (type === 'PENTABLET') return 'Pen Tablet';
		if (type === 'PENDISPLAY') return 'Pen Display';
		if (type === 'STANDALONE') return 'Standalone';
		return type;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onBackdropClick} role="dialog" aria-modal="true" aria-label="Add tablet">
	<div class="modal">
		<div class="modal-header">
			<h2>Add Tablet</h2>
			<span class="slot-count" class:full={isFull}>{flaggedIds.length}/{MAX_FLAGGED} slots used</span>
			<button class="close-btn" onclick={onclose} aria-label="Close">✕</button>
		</div>

		<div class="filters">
			<input
				type="search"
				class="search-input"
				placeholder="Search brand, name, or ID…"
				bind:value={searchText}
				autofocus
			/>
			<select bind:value={filterBrand}>
				<option value="">All Brands</option>
				{#each brands as b}
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

		<div class="results-count">{filteredTablets.length} tablet{filteredTablets.length === 1 ? '' : 's'}</div>

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
							title={isFull ? 'Maximum 6 tablets reached' : `Add ${t.Model.Name}`}
						>+ Add</button>
					{/if}
				</li>
			{/each}
			{#if filteredTablets.length === 0}
				<li class="empty" role="listitem">No tablets match your search.</li>
			{/if}
		</ul>

		{#if isFull}
			<p class="full-notice">All 6 slots are used. Unflag a tablet to make room.</p>
		{/if}
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

	.slot-count.full {
		color: #dc2626;
		border-color: #fca5a5;
		background: #fef2f2;
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

	.type-badge {
		font-size: 10px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.type-pentablet  { background: #dbeafe; color: #1d4ed8; }
	.type-pendisplay { background: #ede9fe; color: #6d28d9; }
	.type-standalone { background: #d1fae5; color: #065f46; }

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

	.full-notice {
		font-size: 12px;
		color: #dc2626;
		text-align: center;
		padding: 8px 16px;
		margin: 0;
		border-top: 1px solid var(--border);
		flex-shrink: 0;
	}
</style>
