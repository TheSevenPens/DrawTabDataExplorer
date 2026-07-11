<script lang="ts">
	import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
	import { getFieldDef, getOperatorsForField } from '@thesevenpens/queriton';
	import ColumnBar from '$lib/components/ColumnBar.svelte';
	import { fieldOptionLabel } from '$lib/field-option-label.js';
	import {
		AGG_OP_OPTIONS,
		type BuilderAggregator,
		aggOpNeedsField,
	} from '$lib/query-builder/aggregator-types.js';

	let {
		groupBy = $bindable<string[]>([]),
		aggregators = $bindable<BuilderAggregator[]>([]),
		fields,
		fieldGroups,
		onchange,
	}: {
		groupBy: string[];
		aggregators: BuilderAggregator[];
		fields: AnyFieldDisplayDef[];
		fieldGroups: string[];
		onchange: () => void;
	} = $props();

	function addAggregator() {
		const numeric = fields.find((f) => f.type === 'number');
		aggregators = [
			...aggregators,
			{
				op: 'avg',
				name: 'avgValue',
				field: numeric?.key ?? fields[0]?.key ?? '',
			},
		];
		onchange();
	}

	function removeAggregator(index: number) {
		aggregators = aggregators.filter((_, i) => i !== index);
		onchange();
	}

	function onOpChange(index: number, op: BuilderAggregator['op']) {
		const row = aggregators[index];
		if (!row) return;
		const next: BuilderAggregator = { ...row, op };
		if (op === 'count' && !next.name) next.name = 'count';
		if (op === 'countIf') {
			const fieldDef = fields[0];
			const ops = fieldDef ? getOperatorsForField(fieldDef) : [];
			next.filterField = next.filterField ?? fieldDef?.key ?? '';
			next.filterOperator = next.filterOperator ?? ops[0]?.value ?? '==';
			next.filterValue = next.filterValue ?? '';
		}
		aggregators = aggregators.map((a, i) => (i === index ? next : a));
		onchange();
	}
</script>

<div class="summarize-editor">
	<div class="group-by-picker">
		<span class="field-label">Group by</span>
		<ColumnBar
			bind:columns={groupBy}
			{fields}
			{fieldGroups}
			inline
			isOpen={true}
			{onchange}
			ontoggle={() => {}}
		/>
	</div>

	<div class="agg-list">
		<div class="agg-header">
			<span>Aggregators</span>
			<button type="button" class="add-agg" onclick={addAggregator}>+ Add</button>
		</div>
		{#each aggregators as agg, i (i)}
			{@const fieldDef =
				agg.op === 'countIf'
					? getFieldDef(agg.filterField ?? '', fields)
					: getFieldDef(agg.field ?? '', fields)}
			{@const operators = fieldDef ? getOperatorsForField(fieldDef) : []}
			{@const needsValue =
				agg.op === 'countIf' && agg.filterOperator !== 'empty' && agg.filterOperator !== 'notempty'}
			<div class="agg-row">
				<select
					class="select"
					value={agg.op}
					onchange={(e) =>
						onOpChange(i, (e.currentTarget as HTMLSelectElement).value as BuilderAggregator['op'])}
				>
					{#each AGG_OP_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<input
					class="input name-input"
					placeholder="column name"
					bind:value={aggregators[i]!.name}
					{onchange}
				/>
				{#if aggOpNeedsField(agg.op)}
					<select class="select field-select" bind:value={aggregators[i]!.field} {onchange}>
						{#each fields as fd (fd.key)}
							<option value={fd.key}>{fieldOptionLabel(fd)}</option>
						{/each}
					</select>
				{:else if agg.op === 'countIf'}
					<select class="select field-select" bind:value={aggregators[i]!.filterField} {onchange}>
						{#each fields as fd (fd.key)}
							<option value={fd.key}>{fieldOptionLabel(fd)}</option>
						{/each}
					</select>
					<select class="select op-select" bind:value={aggregators[i]!.filterOperator} {onchange}>
						{#each operators as op (op.value)}
							<option value={op.value}>{op.label}</option>
						{/each}
					</select>
					{#if needsValue}
						<input
							class="input value-input"
							placeholder="value"
							bind:value={aggregators[i]!.filterValue}
							{onchange}
						/>
					{/if}
				{/if}
				<button
					type="button"
					class="remove-agg"
					title="Remove aggregator"
					onclick={() => removeAggregator(i)}>×</button
				>
			</div>
		{/each}
	</div>
</div>

<style>
	.summarize-editor {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.group-by-picker {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		color: var(--text-dim);
	}

	.input,
	.select {
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
	}

	.agg-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.agg-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 12px;
		color: var(--text-dim);
	}

	.add-agg {
		border: 1px dashed var(--border);
		background: var(--bg-card);
		color: var(--text-muted);
		border-radius: 4px;
		padding: 2px 8px;
		font-size: 12px;
		cursor: pointer;
	}

	.add-agg:hover {
		border-color: var(--text-dim);
		color: var(--text);
	}

	.agg-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}

	.name-input {
		width: 7rem;
	}

	.field-select {
		min-width: 10rem;
		max-width: 14rem;
	}

	.op-select {
		min-width: 6rem;
	}

	.value-input {
		width: 7rem;
	}

	.remove-agg {
		width: 26px;
		height: 26px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
	}

	.remove-agg:hover {
		color: #e11d48;
		border-color: #fecaca;
	}
</style>
