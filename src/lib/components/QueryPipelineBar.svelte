<script lang="ts">
	import { type AnyFieldDef, type Step } from 'queriton';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import ColumnBar from '$lib/components/ColumnBar.svelte';
	import SavedViews from '$lib/components/SavedViews.svelte';

	interface FilterItem {
		field: string;
		operator: string;
		value: string;
		disabled?: boolean;
	}

	interface SortItem {
		field: string;
		direction: 'asc' | 'desc';
	}

	let {
		filters = $bindable(),
		sorts = $bindable(),
		columns = $bindable(),
		fields,
		fieldGroups,
		defaultFilterField,
		onchange,
		steps,
		entityType,
		defaultView,
		onload,
	}: {
		filters: FilterItem[];
		sorts: SortItem[];
		columns: string[];
		fields: AnyFieldDef[];
		fieldGroups: string[];
		defaultFilterField?: string;
		onchange: () => void;
		steps: Step[];
		entityType: string;
		defaultView: Step[];
		onload: (steps: Step[]) => void;
	} = $props();

	let openPanel: 'filter' | 'sort' | 'columns' | 'views' | null = $state(null);

	function toggle(name: 'filter' | 'sort' | 'columns' | 'views') {
		openPanel = openPanel === name ? null : name;
	}

	function closeAll() {
		openPanel = null;
	}
</script>

<svelte:window onclick={closeAll} />

<div class="toolbar" role="none" onclick={(e) => e.stopPropagation()}>
	<FilterBar
		bind:filters
		{fields}
		{fieldGroups}
		{defaultFilterField}
		isOpen={openPanel === 'filter'}
		{onchange}
		ontoggle={() => toggle('filter')}
	/>

	<SortBar
		bind:sorts
		{fields}
		{fieldGroups}
		isOpen={openPanel === 'sort'}
		{onchange}
		ontoggle={() => toggle('sort')}
	/>

	<ColumnBar
		bind:columns
		{fields}
		{fieldGroups}
		isOpen={openPanel === 'columns'}
		{onchange}
		ontoggle={() => toggle('columns')}
	/>

	<!-- Views -->
	<div class="toolbar-item views-item">
		<button
			class="toolbar-btn views-btn"
			class:open={openPanel === 'views'}
			onclick={() => toggle('views')}
		>
			Views
		</button>
		{#if openPanel === 'views'}
			<div class="panel views-panel">
				<SavedViews
					{steps}
					{entityType}
					{defaultView}
					onload={(s) => {
						onload(s);
						openPanel = null;
					}}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}

	.toolbar-item {
		position: relative;
	}

	.toolbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		font-size: 13px;
		min-height: 28px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		line-height: 1;
	}

	.toolbar-btn:hover,
	.toolbar-btn.open {
		border-color: var(--text-dim);
		color: var(--text);
		background: var(--hover-bg);
	}

	.panel {
		position: absolute;
		top: calc(100% + 4px);
		z-index: 100;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
		padding: 10px 12px;
		min-width: 260px;
	}

	.views-item .panel {
		left: auto;
		right: 0;
		min-width: 360px;
	}
</style>
