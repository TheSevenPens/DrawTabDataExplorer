<script lang="ts">
	import { type Step, type FilterStep as FilterStepType, type SortStep as SortStepType, type SelectStep as SelectStepType, type FieldDef, executePipeline } from '$data/lib/pipeline/index.js';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import ColumnBar from '$lib/components/ColumnBar.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import SavedViews from '$lib/components/SavedViews.svelte';
	import { loadColumnWidths, saveColumnWidths } from '$lib/column-widths.js';

	let {
		title,
		entityType,
		entityLabel,
		data,
		fields,
		fieldGroups,
		defaultColumns,
		defaultView,
		detailBasePath = "",
	}: {
		title: string;
		entityType: string;
		entityLabel: string;
		data: any[];
		fields: FieldDef<any>[];
		fieldGroups: string[];
		defaultColumns: string[];
		defaultView: Step[];
		detailBasePath?: string;
	} = $props();

	interface FilterItem {
		field: string;
		operator: string;
		value: string;
	}

	interface SortItem {
		field: string;
		direction: 'asc' | 'desc';
	}

	function getInitialColumns(): string[] {
		const parsed = JSON.parse(JSON.stringify(defaultView)) as Step[];
		const selectStep = parsed.find((s): s is SelectStepType => s.kind === 'select');
		return selectStep ? selectStep.fields : [...defaultColumns];
	}

	function getInitialFilters(): FilterItem[] {
		// Check URL for ?filter=Field:operator:value params
		const urlFilters = page.url.searchParams.getAll('filter');
		if (urlFilters.length > 0) {
			return urlFilters.map(f => {
				const parts = f.split(':');
				return {
					field: parts[0] ?? '',
					operator: parts[1] ?? '==',
					value: parts.slice(2).join(':'),
				};
			}).filter(f => f.field);
		}
		const parsed = JSON.parse(JSON.stringify(defaultView)) as Step[];
		return parsed
			.filter((s): s is FilterStepType => s.kind === 'filter')
			.map(s => ({ field: s.field, operator: s.operator, value: s.value }));
	}

	function getInitialSorts(): SortItem[] {
		const parsed = JSON.parse(JSON.stringify(defaultView)) as Step[];
		return parsed
			.filter((s): s is SortStepType => s.kind === 'sort')
			.map(s => ({ field: s.field, direction: s.direction }));
	}

	let filters: FilterItem[] = $state(getInitialFilters());
	let sorts: SortItem[] = $state(getInitialSorts());
	let selectedColumns: string[] = $state(getInitialColumns());
	let columnWidths: Record<string, number> = $state({});
	let tick = $state(0);
	let searchText = $state('');

	onMount(() => {
		columnWidths = loadColumnWidths(entityType);
	});

	function onWidthChange() {
		saveColumnWidths(entityType, columnWidths);
	}

	let allSteps = $derived.by((): Step[] => {
		void tick;
		const steps: Step[] = [];
		for (const f of filters) {
			const needsValue = f.operator !== 'empty' && f.operator !== 'notempty';
			if (!f.disabled && (!needsValue || f.value !== '')) {
				steps.push({ kind: 'filter', field: f.field, operator: f.operator, value: f.value });
			}
		}
		for (const s of sorts) {
			steps.push({ kind: 'sort', field: s.field, direction: s.direction });
		}
		steps.push({ kind: 'select' as const, fields: selectedColumns });
		return steps;
	});

	let pipelineResult = $derived.by(() => {
		return executePipeline(data, allSteps, fields, defaultColumns);
	});

	let result = $derived.by(() => {
		const r = pipelineResult;
		if (!searchText.trim()) return r;
		const q = searchText.trim().toLowerCase();
		const fieldDefs = r.visibleFields.map(key => fields.find(f => f.key === key)).filter(Boolean);
		const filtered = r.data.filter(row =>
			fieldDefs.some(f => {
				const val = f!.getValue(row);
				return val != null && String(val).toLowerCase().includes(q);
			})
		);
		return { ...r, data: filtered };
	});

	function refresh() {
		tick++;
	}

	function loadView(loaded: Step[]) {
		const selectStep = loaded.find((s): s is SelectStepType => s.kind === 'select');
		selectedColumns = selectStep ? [...selectStep.fields] : [...defaultColumns];
		filters = loaded
			.filter((s): s is FilterStepType => s.kind === 'filter')
			.map(s => ({ field: s.field, operator: s.operator, value: s.value }));
		sorts = loaded
			.filter((s): s is SortStepType => s.kind === 'sort')
			.map(s => ({ field: s.field, direction: s.direction }));
		refresh();
	}

	let stepsForSave = $derived.by((): Step[] => {
		void tick;
		const steps: Step[] = [];
		for (const f of filters) {
			steps.push({ kind: 'filter' as const, field: f.field, operator: f.operator, value: f.value });
		}
		for (const s of sorts) {
			steps.push({ kind: 'sort' as const, field: s.field, direction: s.direction });
		}
		steps.push({ kind: 'select' as const, fields: selectedColumns });
		return steps;
	});
</script>

<div class="title-row">
	<h1>{title}</h1>
	<span class="results-count">Showing {result.data.length} of {data.length} {entityLabel}</span>
</div>

<slot name="nav" />

<div class="search-bar">
	<input type="text" placeholder="Search..." bind:value={searchText} />
	{#if searchText}
		<button class="search-clear" onclick={() => searchText = ''}>Clear</button>
	{/if}
</div>

<section class="views-section">
	<h2>Views</h2>
	<SavedViews steps={stepsForSave} {entityType} {defaultView} onload={loadView} />
</section>

<FilterBar bind:filters {fields} {fieldGroups} onchange={refresh} />

<SortBar bind:sorts {fields} {fieldGroups} onchange={refresh} />

<ColumnBar bind:columns={selectedColumns} {fields} {fieldGroups} onchange={refresh} />

<ResultsTable data={result.data} visibleFields={result.visibleFields} {fields} total={data.length} {entityLabel} {detailBasePath} bind:columnWidths onwidthchange={onWidthChange} />

<style>
	.title-row {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 8px;
	}

	h1 { margin: 0; }

	.results-count {
		font-size: 14px;
		color: var(--text-dim);
	}

	.views-section {
		margin-bottom: 12px;
		border: 1px solid var(--border-light);
		border-radius: 6px;
		padding: 6px 10px;
		background: var(--bg-card);
	}

	.views-section h2 {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 4px;
	}

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

	.search-clear {
		padding: 5px 10px;
		font-size: 13px;
		border: 1px solid var(--border-light);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	.search-clear:hover {
		border-color: var(--text-muted);
	}

</style>
