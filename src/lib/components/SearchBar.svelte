<script lang="ts">
	import type { AnyFieldDef } from 'queriton';

	interface QuickFilterOption {
		fieldDef: AnyFieldDef;
		values: string[];
	}

	let {
		searchText = $bindable(),
		quickFilters = $bindable(),
		quickFilterOptions,
	}: {
		searchText: string;
		quickFilters: Record<string, string>;
		quickFilterOptions: QuickFilterOption[];
	} = $props();

	let isDirty = $derived(searchText !== '' || Object.values(quickFilters).some((v) => v !== ''));

	function clear() {
		searchText = '';
		quickFilters = {};
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
	{#if isDirty}
		<button class="clear-btn" onclick={clear}>Clear</button>
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

	.search-bar input {
		padding: 5px 26px 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
		width: 260px;
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
