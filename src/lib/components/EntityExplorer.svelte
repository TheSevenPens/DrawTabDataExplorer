<script lang="ts">
	import { type Step, type FilterStep as FilterStepType, type SortStep as SortStepType, type SelectStep as SelectStepType, type FieldDef, type AnyFieldDef, executePipeline } from '$data/lib/pipeline/index.js';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import QueryPipelineBar from '$lib/components/QueryPipelineBar.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import ExportDialog from '$lib/components/ExportDialog.svelte';
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
		linkField = "EntityId",
		cellLinks = {} as Record<string, (item: any) => { label: string; href: string }[]>,
		quickFilterFields = [],
		defaultFilterField,
		defaultSortField,
		flaggedIds,
		onToggleFlag,
		titleTag,
	}: {
		title: string;
		entityType: string;
		entityLabel: string;
		data: any[];
		fields: AnyFieldDef[];
		fieldGroups: string[];
		defaultColumns: string[];
		defaultView: Step[];
		detailBasePath?: string;
		linkField?: string;
		cellLinks?: Record<string, (item: any) => { label: string; href: string }[]>;
		quickFilterFields?: string[];
		defaultFilterField?: string;
		defaultSortField?: string;
		flaggedIds?: Set<string>;
		onToggleFlag?: (entityId: string) => void;
		titleTag?: 'h1' | 'h2';
	} = $props();

	let resolvedTitleTag = $derived(titleTag ?? 'h1');

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
	let quickFilters: Record<string, string> = $state({});
	let showExport = $state(false);

	interface QuickFilterOption {
		fieldDef: AnyFieldDef;
		values: string[];
	}

	let quickFilterOptions = $derived.by((): QuickFilterOption[] => {
		return quickFilterFields.map(key => {
			const fieldDef = fields.find(f => f.key === key);
			if (!fieldDef) return null;
			const vals = new Set<string>();
			for (const row of data) {
				const v = String(fieldDef.getValue(row) ?? '').trim();
				if (v && v !== '-') vals.add(v);
			}
			return { fieldDef, values: [...vals].sort() };
		}).filter(Boolean) as QuickFilterOption[];
	});

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
		let filtered = r.data;

		// Apply quick filters
		const activeQuick = Object.entries(quickFilters).filter(([, v]) => v !== '');
		if (activeQuick.length > 0) {
			filtered = filtered.filter(row =>
				activeQuick.every(([key, val]) => {
					const fd = fields.find(f => f.key === key);
					if (!fd) return true;
					return String(fd.getValue(row) ?? '') === val;
				})
			);
		}

		// Apply search — check visible fields plus any fields marked alwaysSearch
		if (searchText.trim()) {
			const q = searchText.trim().toLowerCase();
			const visibleDefs = r.visibleFields.map(key => fields.find(f => f.key === key)).filter(Boolean);
			const alwaysDefs = fields.filter(f => f.alwaysSearch && !r.visibleFields.includes(f.key));
			const searchDefs = [...visibleDefs, ...alwaysDefs];
			filtered = filtered.filter(row =>
				searchDefs.some(f => {
					const val = f!.getValue(row);
					return val != null && String(val).toLowerCase().includes(q);
				})
			);
		}

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
	<svelte:element this={resolvedTitleTag}>{title}</svelte:element>
	<span class="results-count">Showing {result.data.length} of {data.length} {entityLabel}</span>
	<button class="export-btn" onclick={() => showExport = true} title="Export data">
		<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
			<path d="M8 2v8M5 7l3 3 3-3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2"/>
		</svg>
		Export
	</button>
</div>

{#if showExport}
	<ExportDialog
		allData={data}
		filteredData={result.data}
		allFields={fields}
		visibleFields={result.visibleFields}
		{entityType}
		onclose={() => showExport = false}
	/>
{/if}

<slot name="nav" />

<div class="top-bar">
	<SearchBar bind:searchText bind:quickFilters {quickFilterOptions} />
	<QueryPipelineBar bind:filters bind:sorts bind:columns={selectedColumns} {fields} {fieldGroups} {defaultFilterField} onchange={refresh} steps={stepsForSave} {entityType} {defaultView} onload={loadView} />
</div>

<ResultsTable data={result.data} visibleFields={result.visibleFields} {fields} total={data.length} {entityLabel} {detailBasePath} {linkField} {cellLinks} bind:columnWidths onwidthchange={onWidthChange} {flaggedIds} {onToggleFlag} />

<style>
	.title-row {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 8px;
	}

	h1 { margin: 0; }

	h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.4px;
	}

	.results-count {
		font-size: 14px;
		color: var(--text-dim);
	}

	.export-btn {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}
	.export-btn:hover {
		border-color: var(--text-dim);
		color: var(--text);
	}

	.top-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}


</style>
