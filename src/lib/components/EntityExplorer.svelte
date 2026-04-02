<script lang="ts">
	import { type Step, type SelectStep as SelectStepType, type FieldDef, executePipeline } from '$data/lib/pipeline/index.js';
	import FilterStep from '$lib/components/FilterStep.svelte';
	import SortStep from '$lib/components/SortStep.svelte';
	import SelectStep from '$lib/components/SelectStep.svelte';
	import TakeStep from '$lib/components/TakeStep.svelte';
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
		defaultSortField = "Brand",
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
		defaultSortField?: string;
	} = $props();

	// Extract initial column selection from default view, or use defaultColumns
	function getInitialColumns(): string[] {
		const parsed = JSON.parse(JSON.stringify(defaultView)) as Step[];
		const selectStep = parsed.find((s): s is SelectStepType => s.kind === 'select');
		return selectStep ? selectStep.fields : [...defaultColumns];
	}

	// Extract initial pipeline steps (everything except select)
	function getInitialSteps(): Step[] {
		const parsed = JSON.parse(JSON.stringify(defaultView)) as Step[];
		return parsed.filter(s => s.kind !== 'select');
	}

	let steps: Step[] = $state(getInitialSteps());
	let selectedColumns: string[] = $state(getInitialColumns());
	let tick = $state(0);

	// Build combined steps for execution (pipeline steps + column selection)
	let allSteps = $derived.by((): Step[] => {
		void tick;
		return [...steps, { kind: 'select' as const, fields: selectedColumns }];
	});

	let result = $derived.by(() => {
		return executePipeline(data, allSteps, fields, defaultColumns);
	});

	function refresh() {
		tick++;
	}

	function addStep(kind: 'filter' | 'sort' | 'take') {
		switch (kind) {
			case 'filter':
				steps.push({ kind: 'filter', field: defaultFilterField, operator: '==', value: '' });
				break;
			case 'sort':
				steps.push({ kind: 'sort', field: defaultSortField, direction: 'asc' });
				break;
		}
	}

	function removeStep(index: number) {
		steps.splice(index, 1);
	}

	function loadView(loaded: Step[]) {
		// Separate column selection from pipeline steps
		const selectStep = loaded.find((s): s is SelectStepType => s.kind === 'select');
		selectedColumns = selectStep ? [...selectStep.fields] : [...defaultColumns];
		steps = loaded.filter(s => s.kind !== 'select');
		refresh();
	}

	// For saving views, combine pipeline steps + column selection
	let stepsForSave = $derived.by((): Step[] => {
		void tick;
		return [...steps, { kind: 'select' as const, fields: selectedColumns }];
	});

	// Column selection as a bindable step object for SelectStep component
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

	{#each steps as step, i (i)}
		<div class="pipe-connector">|</div>

		{#if step.kind === 'filter'}
			<FilterStep bind:step={steps[i]} {fields} onchange={refresh} onremove={() => removeStep(i)} />
		{:else if step.kind === 'sort'}
			<SortStep bind:step={steps[i]} {fields} onchange={refresh} onremove={() => removeStep(i)} />
		{/if}
	{/each}
</div>

<div class="add-step">
	<button onclick={() => addStep('filter')}>+ Filter</button>
	<button onclick={() => addStep('sort')}>+ Sort</button>
</div>

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
		margin-bottom: 20px;
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
