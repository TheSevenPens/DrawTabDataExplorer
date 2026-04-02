<script lang="ts">
	import { type Step, type SortStep as SortStepType, type SelectStep as SelectStepType, type FieldDef, executePipeline } from '$data/lib/pipeline/index.js';
	import FilterStep from '$lib/components/FilterStep.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import SelectStep from '$lib/components/SelectStep.svelte';
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
		defaultFilterField = "Brand",
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
		defaultFilterField?: string;
	} = $props();

	interface SortItem {
		field: string;
		direction: 'asc' | 'desc';
	}

	// Extract initial state from default view
	function getInitialColumns(): string[] {
		const parsed = JSON.parse(JSON.stringify(defaultView)) as Step[];
		const selectStep = parsed.find((s): s is SelectStepType => s.kind === 'select');
		return selectStep ? selectStep.fields : [...defaultColumns];
	}

	function getInitialFilters(): Step[] {
		const parsed = JSON.parse(JSON.stringify(defaultView)) as Step[];
		return parsed.filter(s => s.kind === 'filter');
	}

	function getInitialSorts(): SortItem[] {
		const parsed = JSON.parse(JSON.stringify(defaultView)) as Step[];
		return parsed
			.filter((s): s is SortStepType => s.kind === 'sort')
			.map(s => ({ field: s.field, direction: s.direction }));
	}

	let filterSteps: Step[] = $state(getInitialFilters());
	let sorts: SortItem[] = $state(getInitialSorts());
	let selectedColumns: string[] = $state(getInitialColumns());
	let tick = $state(0);

	// Build combined steps for execution
	let allSteps = $derived.by((): Step[] => {
		void tick;
		const steps: Step[] = [...filterSteps];
		for (const sort of sorts) {
			steps.push({ kind: 'sort', field: sort.field, direction: sort.direction });
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

	function addFilter() {
		filterSteps.push({ kind: 'filter', field: defaultFilterField, operator: '==', value: '' });
	}

	function removeFilter(index: number) {
		filterSteps.splice(index, 1);
	}

	function loadView(loaded: Step[]) {
		const selectStep = loaded.find((s): s is SelectStepType => s.kind === 'select');
		selectedColumns = selectStep ? [...selectStep.fields] : [...defaultColumns];
		filterSteps = loaded.filter(s => s.kind === 'filter');
		sorts = loaded
			.filter((s): s is SortStepType => s.kind === 'sort')
			.map(s => ({ field: s.field, direction: s.direction }));
		refresh();
	}

	// For saving views, combine all state into steps
	let stepsForSave = $derived.by((): Step[] => {
		void tick;
		const steps: Step[] = [...filterSteps];
		for (const sort of sorts) {
			steps.push({ kind: 'sort' as const, field: sort.field, direction: sort.direction });
		}
		steps.push({ kind: 'select' as const, fields: selectedColumns });
		return steps;
	});

	// Column selection
	let columnStep = $derived.by((): SelectStepType => {
		void tick;
		return { kind: 'select', fields: selectedColumns };
	});

	function onColumnsChange() {
		selectedColumns = [...columnStep.fields];
		refresh();
	}
</script>

<h1>{title}</h1>

<slot name="nav" />

<section class="views-section">
	<h2>Views</h2>
	<SavedViews steps={stepsForSave} {entityType} {defaultView} onload={loadView} />
</section>

<div class="pipeline">
	<div class="pipeline-source">
		{title} <span class="count">({data.length} records)</span>
	</div>

	{#each filterSteps as step, i (i)}
		<div class="pipe-connector">|</div>
		<FilterStep bind:step={filterSteps[i]} {fields} onchange={refresh} onremove={() => removeFilter(i)} />
	{/each}
</div>

<div class="add-step">
	<button onclick={addFilter}>+ Filter</button>
</div>

<SortBar bind:sorts {fields} onchange={refresh} />

<section class="columns-section">
	<SelectStep step={columnStep} {fields} {fieldGroups} onchange={onColumnsChange} onremove={() => {}} removable={false} />
</section>

<ResultsTable data={result.data} visibleFields={result.visibleFields} {fields} total={data.length} {entityLabel} {detailBasePath} />

<style>
	h1 { margin-bottom: 8px; }

	.views-section {
		margin-bottom: 16px;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 12px 14px;
		background: #fff;
	}

	.views-section h2 {
		font-size: 14px;
		font-weight: 600;
		color: #555;
		margin-bottom: 6px;
	}

	.pipeline { margin-bottom: 20px; }

	.pipeline-source {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #2563eb;
		color: #fff;
		padding: 8px 14px;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 8px;
	}

	.pipeline-source .count {
		font-weight: 400;
		opacity: 0.8;
	}

	.add-step {
		margin-top: 8px;
		margin-bottom: 16px;
		display: flex;
		gap: 6px;
	}

	.add-step button {
		padding: 6px 12px;
		font-size: 13px;
		border: 1px dashed #aaa;
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		color: #555;
	}

	.add-step button:hover {
		border-color: #2563eb;
		color: #2563eb;
	}

	.columns-section {
		margin-bottom: 20px;
	}
</style>
