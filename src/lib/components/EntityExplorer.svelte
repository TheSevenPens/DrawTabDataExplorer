<script lang="ts">
	import { type Step, type FilterStep as FilterStepType, type SortStep as SortStepType, type SelectStep as SelectStepType, type FieldDef, executePipeline } from '$data/lib/pipeline/index.js';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import ColumnBar from '$lib/components/ColumnBar.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import SavedViews from '$lib/components/SavedViews.svelte';

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
	let tick = $state(0);

	let allSteps = $derived.by((): Step[] => {
		void tick;
		const steps: Step[] = [];
		for (const f of filters) {
			steps.push({ kind: 'filter', field: f.field, operator: f.operator, value: f.value });
		}
		for (const s of sorts) {
			steps.push({ kind: 'sort', field: s.field, direction: s.direction });
		}
		steps.push({ kind: 'select' as const, fields: selectedColumns });
		return steps;
	});

	let result = $derived.by(() => {
		return executePipeline(data, allSteps, fields, defaultColumns);
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

<section class="views-section">
	<h2>Views</h2>
	<SavedViews steps={stepsForSave} {entityType} {defaultView} onload={loadView} />
</section>

<FilterBar bind:filters {fields} onchange={refresh} />

<SortBar bind:sorts {fields} onchange={refresh} />

<ColumnBar bind:columns={selectedColumns} {fields} {fieldGroups} onchange={refresh} />

<ResultsTable data={result.data} visibleFields={result.visibleFields} {fields} total={data.length} {entityLabel} {detailBasePath} />

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
		color: #888;
	}

	.views-section {
		margin-bottom: 12px;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 6px 10px;
		background: #fff;
	}

	.views-section h2 {
		font-size: 13px;
		font-weight: 600;
		color: #555;
		margin-bottom: 4px;
	}

</style>
