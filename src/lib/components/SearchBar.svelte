<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';

	interface QuickFilterOption {
		fieldDef: AnyFieldDisplayDef;
		values: string[];
	}

	let {
		searchText = $bindable(),
		quickFilters = $bindable(),
		quickFilterOptions,
		ownedOnly = $bindable(false),
		ownedOnlyLabel,
	}: {
		searchText: string;
		quickFilters: Record<string, string>;
		quickFilterOptions: QuickFilterOption[];
		/** Two-way bound boolean. Only rendered as a checkbox when
		 * `ownedOnlyLabel` is set. EntityExplorer reads it and filters to
		 * rows whose configured numeric field is > 0. */
		ownedOnly?: boolean;
		/** When set, render an "owned only" checkbox after the quick-filter
		 * dropdowns. The label is shown next to the checkbox (e.g. "In
		 * inventory only"). */
		ownedOnlyLabel?: string;
	} = $props();

	let isDirty = $derived(
		searchText !== '' || Object.values(quickFilters).some((v) => v !== '') || ownedOnly,
	);

	function clear() {
		searchText = '';
		quickFilters = {};
		ownedOnly = false;
	}
</script>

<div class="search-bar">
	<div class="input-wrap">
		<input type="text" placeholder="Search..." bind:value={searchText} />
		{#if searchText !== ''}
			<button class="input-clear" onclick={() => (searchText = '')} aria-label="Clear search"
				>×</button
			>
		{/if}
	</div>
	{#each quickFilterOptions as qf (qf.fieldDef.key)}
		<select bind:value={quickFilters[qf.fieldDef.key]}>
			<option value="">All {qf.fieldDef.label}</option>
			{#each qf.values as v (v)}
				<option value={v}>{v}</option>
			{/each}
		</select>
	{/each}
	{#if ownedOnlyLabel}
		<label class="owned-toggle">
			<input type="checkbox" bind:checked={ownedOnly} />
			{ownedOnlyLabel}
		</label>
	{/if}
	{#if isDirty}
		<Button variant="subtle" onclick={clear}>Clear</Button>
	{/if}
</div>

<style>
	.search-bar {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.input-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.search-bar input[type='text'] {
		padding: 6px 26px 6px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text);
		width: 260px;
	}

	.search-bar input[type='text']:focus {
		outline: none;
		border-color: var(--accent);
	}

	.input-clear {
		position: absolute;
		right: 6px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 16px;
		line-height: 1;
		padding: 0 2px;
		display: flex;
		align-items: center;
	}

	.input-clear:hover {
		color: var(--text);
	}

	.search-bar select {
		padding: 6px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text);
	}

	.search-bar select:focus {
		outline: none;
		border-color: var(--accent);
	}

	.owned-toggle {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 13px;
		color: var(--text);
		white-space: nowrap;
		user-select: none;
		cursor: pointer;
	}
	.owned-toggle input {
		margin: 0;
	}
</style>
