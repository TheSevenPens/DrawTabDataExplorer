<script lang="ts">
	import type { FieldDef } from '$data/lib/pipeline/index.js';

	interface QuickFilterOption {
		fieldDef: FieldDef<any>;
		values: string[];
	}

	let { searchText = $bindable(), quickFilters = $bindable(), quickFilterOptions }: {
		searchText: string;
		quickFilters: Record<string, string>;
		quickFilterOptions: QuickFilterOption[];
	} = $props();

	let isDirty = $derived(
		searchText !== '' || Object.values(quickFilters).some(v => v !== '')
	);

	function clear() {
		searchText = '';
		quickFilters = {};
	}
</script>

<div class="search-bar">
	<input type="text" placeholder="Search..." bind:value={searchText} />
	{#each quickFilterOptions as qf}
		<select bind:value={quickFilters[qf.fieldDef.key]}>
			<option value="">All {qf.fieldDef.label}</option>
			{#each qf.values as v}
				<option value={v}>{v}</option>
			{/each}
		</select>
	{/each}
	{#if isDirty}
		<button class="clear-btn" onclick={clear}>Clear</button>
	{/if}
</div>

<style>
	.search-bar {
		display: flex;
		gap: 6px;
		margin-bottom: 12px;
	}

	.search-bar input {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
		width: 260px;
	}

	.search-bar select {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}

	.clear-btn {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border-light);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	.clear-btn:hover {
		border-color: var(--text-muted);
	}
</style>
