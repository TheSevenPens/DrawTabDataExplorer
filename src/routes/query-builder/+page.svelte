<script lang="ts">
	import ChromeLayout from '$lib/components/ChromeLayout.svelte';
	import Button from '$lib/components/Button.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import ColumnBar from '$lib/components/ColumnBar.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import SortBar from '$lib/components/SortBar.svelte';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import { dataSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import { buildTableShape, stripMetaNoise } from '$lib/api-explorer/result-table.js';
	import { TABLET_FIELDS, TABLET_FIELD_GROUPS } from '$data/lib/entities/tablet-fields.js';
	import { PEN_FIELDS, PEN_FIELD_GROUPS } from '$data/lib/entities/pen-fields.js';
	import {
		PEN_COMPAT_FIELDS,
		PEN_COMPAT_FIELD_GROUPS,
	} from '$data/lib/entities/pen-compat-fields.js';
	import { DRIVER_FIELDS, DRIVER_FIELD_GROUPS } from '$data/lib/entities/driver-fields.js';
	import {
		PRESSURE_RESPONSE_FIELDS,
		PRESSURE_RESPONSE_FIELD_GROUPS,
	} from '$data/lib/entities/pressure-response-fields.js';
	import {
		type AnyFieldDisplayDef,
		getFieldDef,
		getOperatorsForField,
	} from '@thesevenpens/queriton';
	import {
		BASIC_TEMPLATES,
		buildGroupedTemplates,
		type BuilderCollection,
		type BuilderFilter,
		type BuilderOutput,
		type BuilderSort,
		type QueryBuilderTemplate,
	} from '$lib/query-builder/mockup-templates.js';
	import type { BuilderAggregator } from '$lib/query-builder/aggregator-types.js';
	import SummarizeEditor from '$lib/query-builder/SummarizeEditor.svelte';
	import { summarizeOutputFieldKeys } from '$lib/query-builder/summarize-spec.js';
	import { buildQueryCode } from '$lib/query-builder/code-preview.js';
	import { executeBuilderQuery } from '$lib/query-builder/execute-builder-query.js';
	import { fieldOptionLabel } from '$lib/field-option-label.js';
	import type { DrawTabDataSet } from '$data/lib/dataset.js';
	import type { PipelineSection } from '$lib/query-builder/pipeline-field-drag.js';

	let { data } = $props();

	const dataTabs = dataSubNavTabs();

	const groupedTemplates = buildGroupedTemplates();

	const COLLECTIONS: BuilderCollection[] = [
		'Tablets',
		'Pens',
		'PenCompat',
		'Drivers',
		'PressureResponse',
	];

	const collectionMeta: Record<
		BuilderCollection,
		{ fields: AnyFieldDisplayDef[]; groups: string[] }
	> = {
		Tablets: { fields: TABLET_FIELDS, groups: TABLET_FIELD_GROUPS },
		Pens: { fields: PEN_FIELDS, groups: PEN_FIELD_GROUPS },
		PenCompat: { fields: PEN_COMPAT_FIELDS, groups: PEN_COMPAT_FIELD_GROUPS },
		Drivers: { fields: DRIVER_FIELDS, groups: DRIVER_FIELD_GROUPS },
		PressureResponse: {
			fields: PRESSURE_RESPONSE_FIELDS,
			groups: PRESSURE_RESPONSE_FIELD_GROUPS,
		},
	};

	let collection = $state<BuilderCollection>('Tablets');
	let filters = $state<BuilderFilter[]>([]);
	let sorts = $state<BuilderSort[]>([]);
	let columns = $state<string[]>(['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear']);
	let skip = $state<number | ''>('');
	let take = $state<number | ''>(5);
	let outputMode = $state<BuilderOutput['mode']>('toArray');
	let distinctField = $state('ModelType');
	let countByFields = $state<string[]>(['Brand']);
	let summarizeGroupBy = $state<string[]>(['Brand']);
	let summarizeAggregators = $state<BuilderAggregator[]>([{ op: 'count', name: 'count' }]);
	let havingFilters = $state<BuilderFilter[]>([]);

	let fields = $derived(collectionMeta[collection].fields);
	let fieldGroups = $derived(collectionMeta[collection].groups);

	let output = $derived.by((): BuilderOutput => {
		if (outputMode === 'distinct') return { mode: 'distinct', field: distinctField };
		if (outputMode === 'count') return { mode: 'count' };
		if (outputMode === 'countBy') {
			return { mode: 'countBy', fields: countByFields.length ? countByFields : ['Brand'] };
		}
		if (outputMode === 'summarize') {
			return {
				mode: 'summarize',
				groupBy: summarizeGroupBy.length ? summarizeGroupBy : ['Brand'],
				aggregators: summarizeAggregators,
			};
		}
		return { mode: 'toArray' };
	});

	let codePreview = $derived(
		buildQueryCode({
			collection,
			filters,
			sorts,
			columns,
			skip: skip === '' ? undefined : Number(skip),
			take: take === '' ? undefined : Number(take),
			havingFilters: outputMode === 'summarize' ? havingFilters : undefined,
			output,
		}),
	);

	let result = $state<unknown>(undefined);
	let error = $state<string | null>(null);
	let running = $state(false);
	let elapsedMs = $state<number | null>(null);
	let viewMode = $state<'json' | 'table'>('table');
	let showMeta = $state(false);

	let ds = $derived(data.ds as DrawTabDataSet);

	const AGGREGATE_GROUP = 'Aggregate';

	function syntheticSummarizeFields(keys: string[]): AnyFieldDisplayDef[] {
		return keys.map((key) => {
			const existing = fields.find((f) => f.key === key);
			if (existing) return existing;
			return {
				key,
				label: key,
				group: AGGREGATE_GROUP,
				type: 'number',
				getValue: () => '',
			};
		});
	}

	let sortPickerFields = $derived.by((): AnyFieldDisplayDef[] => {
		if (outputMode === 'summarize') {
			return syntheticSummarizeFields(
				summarizeOutputFieldKeys(summarizeGroupBy, summarizeAggregators),
			);
		}
		if (outputMode !== 'countBy') return fields;
		return [
			...fields,
			{
				key: 'count',
				label: 'count (default)',
				group: AGGREGATE_GROUP,
				type: 'number',
				getValue: () => '',
			},
			{
				key: 'tablets',
				label: 'tablets (count alias)',
				group: AGGREGATE_GROUP,
				type: 'number',
				getValue: () => '',
			},
		];
	});

	let sortPickerGroups = $derived(
		outputMode === 'countBy' || outputMode === 'summarize'
			? [...fieldGroups, AGGREGATE_GROUP]
			: fieldGroups,
	);

	function formatResult(value: unknown): string {
		try {
			return JSON.stringify(value, null, 2);
		} catch (e) {
			return `<<unserializable: ${e instanceof Error ? e.message : String(e)}>>`;
		}
	}

	let displayResult = $derived(showMeta ? result : stripMetaNoise(result));
	let resultJson = $derived(displayResult === undefined ? '' : formatResult(displayResult));
	let tableShape = $derived(displayResult === undefined ? null : buildTableShape(displayResult));

	let resultMeta = $derived.by(() => {
		if (result === undefined) return null;
		if (Array.isArray(result)) return `Array — ${result.length} item(s)`;
		if (result === null) return 'null';
		if (typeof result === 'object') return `Object — ${Object.keys(result).length} key(s)`;
		return typeof result;
	});

	let exportTable = $derived.by<{ headers: string[]; rows: (string | number)[][] } | null>(() => {
		if (!tableShape || tableShape.kind === 'not-tabular') return null;
		const headers: string[] = [...tableShape.columns];
		const rows = tableShape.rows.map((r) => {
			const rec = r as Record<string, string>;
			return headers.map((h) => rec[h] ?? '');
		});
		return { headers, rows };
	});

	function clearResult() {
		result = undefined;
		error = null;
		elapsedMs = null;
	}

	async function runQuery() {
		running = true;
		error = null;
		result = undefined;
		elapsedMs = null;
		viewMode = 'table';
		const start = performance.now();
		try {
			result = await executeBuilderQuery(ds, {
				collection,
				filters,
				sorts,
				columns,
				skip: skip === '' ? undefined : Number(skip),
				take: take === '' ? undefined : Number(take),
				havingFilters: outputMode === 'summarize' ? havingFilters : undefined,
				output,
			});
			elapsedMs = Math.round(performance.now() - start);
		} catch (e) {
			error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
			elapsedMs = Math.round(performance.now() - start);
		} finally {
			running = false;
		}
	}

	function copyResult() {
		if (!resultJson) return;
		navigator.clipboard.writeText(resultJson).catch(() => {});
	}

	function copyQueryCode() {
		navigator.clipboard.writeText(codePreview).catch(() => {});
	}

	function loadTemplate(t: QueryBuilderTemplate) {
		collection = t.collection;
		filters = JSON.parse(JSON.stringify(t.filters));
		sorts = JSON.parse(JSON.stringify(t.sorts));
		columns = [...t.columns];
		skip = t.skip ?? '';
		take = t.take ?? '';
		outputMode = t.output.mode;
		if (t.output.mode === 'distinct') distinctField = t.output.field;
		if (t.output.mode === 'countBy') countByFields = [...t.output.fields];
		if (t.output.mode === 'summarize') {
			summarizeGroupBy = [...t.output.groupBy];
			summarizeAggregators = JSON.parse(JSON.stringify(t.output.aggregators));
		}
		havingFilters = t.havingFilters ? JSON.parse(JSON.stringify(t.havingFilters)) : [];
		clearResult();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			runQuery();
		}
	}

	let filterFieldKeys = $derived(filters.filter((f) => !f.disabled).map((f) => f.field));

	let canAddFilterColumns = $derived(
		filterFieldKeys.some((key) => fields.some((f) => f.key === key) && !columns.includes(key)),
	);

	function addFilterFromField(key: string) {
		if (!fields.some((f) => f.key === key)) return;
		const fieldDef = getFieldDef(key, fields);
		const ops = fieldDef ? getOperatorsForField(fieldDef) : [];
		filters = [...filters, { field: key, operator: ops[0]?.value ?? '==', value: '' }];
		clearResult();
	}

	function addColumnFromField(key: string) {
		if (!fields.some((f) => f.key === key)) return;
		if (!columns.includes(key)) columns = [...columns, key];
		clearResult();
	}

	function addSortFromField(key: string) {
		if (!sortPickerFields.some((f) => f.key === key)) return;
		if (sorts.some((s) => s.field === key)) return;
		sorts = [...sorts, { field: key, direction: 'asc' }];
		clearResult();
	}

	function addFilterColumns() {
		const next = [...columns];
		for (const key of filterFieldKeys) {
			if (fields.some((f) => f.key === key) && !next.includes(key)) {
				next.push(key);
			}
		}
		columns = next;
		clearResult();
	}

	function onCrossSectionDrop(target: PipelineSection, field: string) {
		if (target === 'filters') addFilterFromField(field);
		else if (target === 'columns') addColumnFromField(field);
		else if (target === 'sort') addSortFromField(field);
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<ChromeLayout subNavTabs={dataTabs}>
	<h1>Query Builder</h1>
	<p class="blurb">
		Build <code>DrawTabDataSet</code> queries without typing. Pipeline order matches the API: filter
		→ columns → sort → limit → output. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs. Compare with
		<a href="/api-explorer">API Explorer</a>.
	</p>

	<div class="layout">
		<section class="builder">
			<div class="builder-toolbar">
				<label class="field-label" for="qb-template">Example</label>
				<select
					id="qb-template"
					class="select wide"
					onchange={(e) => {
						const label = (e.currentTarget as HTMLSelectElement).value;
						const t = BASIC_TEMPLATES.find((x) => x.label === label);
						if (t) loadTemplate(t);
						(e.currentTarget as HTMLSelectElement).value = '';
					}}
				>
					<option value="">Load example…</option>
					{#each groupedTemplates as g (g.group)}
						<optgroup label={g.group}>
							{#each g.templates as t (t.label)}
								<option value={t.label}>{t.label}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>
			<div class="pipeline-table-wrap">
				<table class="pipeline-table">
					<tbody>
						<tr>
							<th class="pipeline-label" scope="row">Source</th>
							<td class="pipeline-cell">
								<div class="row">
									<label class="field-label" for="qb-collection">Collection</label>
									<select id="qb-collection" class="select" bind:value={collection}>
										{#each COLLECTIONS as c (c)}
											<option value={c}>{c}</option>
										{/each}
									</select>
								</div>
							</td>
						</tr>

						<tr>
							<th class="pipeline-label" scope="row">Filters</th>
							<td class="pipeline-cell">
								<FilterBar
									bind:filters
									{fields}
									{fieldGroups}
									inline
									isOpen={true}
									pipelineSection="filters"
									enableCrossSectionDrag
									onCrossSectionDrop={(field) => onCrossSectionDrop('filters', field)}
									onchange={clearResult}
									ontoggle={() => {}}
								/>
							</td>
						</tr>

						{#if outputMode === 'toArray'}
							<tr>
								<th class="pipeline-label" scope="row">Columns</th>
								<td class="pipeline-cell">
									<div class="cell-toolbar">
										<span class="hint">{columns.length} selected</span>
										<Button
											variant="subtle"
											size="sm"
											onclick={addFilterColumns}
											disabled={!canAddFilterColumns}
											disabledReason="All active filter fields are already selected"
										>
											Add filter fields
										</Button>
									</div>
									{#if columns.length === 0}
										<p class="hint cell-hint">
											All fields returned when empty (same as no <code>.select()</code>).
										</p>
									{/if}
									<ColumnBar
										bind:columns
										{fields}
										{fieldGroups}
										inline
										isOpen={true}
										pipelineSection="columns"
										enableCrossSectionDrag
										onCrossSectionDrop={(field) => onCrossSectionDrop('columns', field)}
										onchange={clearResult}
										ontoggle={() => {}}
									/>
								</td>
							</tr>
						{/if}

						{#if outputMode === 'toArray' || outputMode === 'countBy' || outputMode === 'summarize'}
							<tr>
								<th class="pipeline-label" scope="row">Sort</th>
								<td class="pipeline-cell">
									{#if outputMode === 'countBy'}
										<p class="hint cell-hint">
											Sorts the grouped result (e.g. by <code>tablets</code> count).
										</p>
									{:else if outputMode === 'summarize'}
										<p class="hint cell-hint">
											Sorts summary rows by group keys or aggregate column names.
										</p>
									{/if}
									<SortBar
										bind:sorts
										fields={sortPickerFields}
										fieldGroups={sortPickerGroups}
										inline
										isOpen={true}
										pipelineSection="sort"
										enableCrossSectionDrag
										onCrossSectionDrop={(field) => onCrossSectionDrop('sort', field)}
										onchange={clearResult}
										ontoggle={() => {}}
									/>
								</td>
							</tr>
						{/if}

						{#if outputMode === 'summarize'}
							<tr>
								<th class="pipeline-label" scope="row">Having</th>
								<td class="pipeline-cell">
									<p class="hint cell-hint">
										Filters summary rows after <code>.summarize()</code> (SQL HAVING).
									</p>
									<FilterBar
										bind:filters={havingFilters}
										fields={sortPickerFields}
										fieldGroups={sortPickerGroups}
										inline
										isOpen={true}
										pipelineSection="filters"
										onchange={clearResult}
										ontoggle={() => {}}
									/>
								</td>
							</tr>
						{/if}

						{#if outputMode === 'toArray' || outputMode === 'summarize'}
							<tr>
								<th class="pipeline-label" scope="row">Limit</th>
								<td class="pipeline-cell">
									<div class="row compact">
										<label class="field-label" for="qb-skip">Skip</label>
										<input
											id="qb-skip"
											class="input narrow"
											type="number"
											min="0"
											bind:value={skip}
										/>
										<label class="field-label" for="qb-take">Take</label>
										<input
											id="qb-take"
											class="input narrow"
											type="number"
											min="0"
											bind:value={take}
										/>
									</div>
								</td>
							</tr>
						{/if}

						<tr>
							<th class="pipeline-label" scope="row">Output</th>
							<td class="pipeline-cell">
								<SegmentedControl
									options={[
										{ value: 'toArray', label: 'Rows' },
										{ value: 'distinct', label: 'Distinct' },
										{ value: 'countBy', label: 'Count by' },
										{ value: 'summarize', label: 'Summarize' },
										{ value: 'count', label: 'Count' },
									]}
									bind:value={outputMode}
									ariaLabel="Output mode"
								/>
								{#if outputMode === 'distinct'}
									<div class="row compact">
										<label class="field-label" for="qb-distinct">Field</label>
										<select id="qb-distinct" class="select" bind:value={distinctField}>
											{#each fields as fd (fd.key)}
												<option value={fd.key}>{fieldOptionLabel(fd)}</option>
											{/each}
										</select>
									</div>
								{:else if outputMode === 'countBy'}
									<div class="group-by-picker">
										<span class="field-label">Group by</span>
										<ColumnBar
											bind:columns={countByFields}
											{fields}
											{fieldGroups}
											inline
											isOpen={true}
											onchange={clearResult}
											ontoggle={() => {}}
										/>
									</div>
								{:else if outputMode === 'summarize'}
									<SummarizeEditor
										bind:groupBy={summarizeGroupBy}
										bind:aggregators={summarizeAggregators}
										{fields}
										{fieldGroups}
										onchange={clearResult}
									/>
								{/if}
							</td>
						</tr>

						<tr class="query-code-row">
							<th class="pipeline-label" scope="row">Query</th>
							<td class="pipeline-cell">
								<details class="query-code">
									<summary>Generated code</summary>
									<p class="hint query-code-hint">
										API Explorer runs this as the body of an async function with <code>ds</code> in
										scope.
										<a href="/api-explorer">Open API Explorer</a> to paste and experiment.
									</p>
									<div class="query-code-toolbar">
										<Button variant="subtle" size="sm" onclick={copyQueryCode}>Copy</Button>
									</div>
									<pre class="code"><code>{codePreview}</code></pre>
								</details>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<aside class="preview">
			<div class="preview-header">
				<span class="preview-label">Result</span>
				<Button variant="primary" size="md" onclick={runQuery} disabled={running}>
					{running ? 'Running…' : 'Run'}
				</Button>
			</div>

			<div class="result-toolbar">
				{#if elapsedMs !== null}
					<span class="meta">{elapsedMs} ms</span>
				{/if}
				{#if resultMeta}
					<span class="meta">{resultMeta}</span>
				{/if}
				<SegmentedControl
					options={[
						{ value: 'table', label: 'Table' },
						{ value: 'json', label: 'JSON' },
					]}
					bind:value={viewMode}
					ariaLabel="Result view"
				/>
				{#if resultJson}
					<label
						class="meta-toggle"
						title="Show loader-internal Meta._id, _CreateDate, _ModifiedDate fields"
					>
						<input type="checkbox" bind:checked={showMeta} />
						Show meta
					</label>
					{#if viewMode === 'table' && exportTable}
						<ExportTableButton
							entityType="query-builder"
							title="Query Builder result"
							filename="query-builder-result"
							headers={exportTable.headers}
							rows={exportTable.rows}
						/>
					{/if}
					<Button variant="subtle" size="sm" onclick={copyResult}>Copy</Button>
				{/if}
			</div>
			{#if error}
				<pre class="result-pane error">{error}</pre>
			{:else if resultJson}
				{#if viewMode === 'json'}
					<pre class="result-pane">{resultJson}</pre>
				{:else if tableShape}
					{#if tableShape.kind === 'not-tabular'}
						<p class="placeholder">{tableShape.reason} Switch to JSON to see this result.</p>
					{:else}
						<div class="result-pane table-wrap">
							<table class="result-table">
								<thead>
									<tr>
										{#each tableShape.columns as col (col)}
											<th>{col}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each tableShape.rows as row, i (i)}
										<tr>
											{#each tableShape.columns as col (col)}
												<td>{(row as Record<string, string>)[col] ?? ''}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}
			{:else if running}
				<p class="placeholder">Running…</p>
			{:else}
				<p class="placeholder">Configure the pipeline and press Run (or Ctrl+Enter).</p>
			{/if}
		</aside>
	</div>
</ChromeLayout>

<style>
	.blurb {
		color: var(--text-dim);
		max-width: 72ch;
		margin-bottom: 16px;
		line-height: 1.5;
	}

	.blurb code {
		background: rgba(0, 0, 0, 0.06);
		padding: 1px 5px;
		border-radius: 3px;
		font-size: 12px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	kbd {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 1px 5px;
		font-size: 11px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.layout {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.builder,
	.preview {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.builder-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.pipeline-table-wrap {
		border: 1px solid var(--border-light);
		border-radius: 8px;
		background: var(--bg-card);
		overflow: visible;
	}

	.pipeline-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
		background: transparent;
		overflow: visible;
	}

	.pipeline-table tr + tr {
		border-top: 1px solid var(--border-light);
	}

	.pipeline-label {
		width: 7rem;
		padding: 10px 12px;
		text-align: left;
		vertical-align: top;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dim);
		white-space: nowrap;
		background: color-mix(in srgb, var(--bg-card) 88%, var(--border));
		border-right: 1px solid var(--border-light);
	}

	.pipeline-cell {
		padding: 8px 12px;
		vertical-align: top;
		min-width: 0;
		overflow: visible;
	}

	.cell-toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 6px;
	}

	.cell-hint {
		margin-bottom: 6px;
	}

	.cell-hint code {
		font-size: 12px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.preview {
		min-height: 200px;
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--border-light);
		padding-top: 16px;
	}

	.query-code {
		margin: 0;
	}

	.query-code > summary {
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
		list-style: none;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.query-code > summary::-webkit-details-marker {
		display: none;
	}

	.query-code > summary::before {
		content: '▸';
		font-size: 12px;
		color: var(--text-dim);
		transition: transform 0.15s ease;
	}

	.query-code[open] > summary::before {
		transform: rotate(90deg);
	}

	.query-code-hint {
		margin: 10px 0 8px;
	}

	.query-code-hint code {
		font-size: 12px;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.query-code-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 6px;
	}

	.query-code .code {
		max-height: 220px;
		min-height: 0;
	}

	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.preview-label {
		font-weight: 600;
		font-size: 15px;
		color: var(--text);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	.row.compact {
		margin-top: 8px;
	}

	.group-by-picker {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
	}

	.field-label {
		font-size: 13px;
		color: var(--text-dim);
	}

	.select,
	.input {
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
	}

	.select.wide {
		min-width: 220px;
		flex: 1;
	}

	.input.narrow {
		width: 88px;
	}

	.hint {
		margin: 0;
		font-size: 12px;
		color: var(--text-dim);
	}

	.code {
		margin: 0;
		padding: 12px;
		border-radius: 6px;
		background: var(--bg);
		border: 1px solid var(--border);
		font-size: 12px;
		line-height: 1.45;
		overflow: auto;
		flex: 1;
		min-height: 280px;
		max-height: min(70vh, 640px);
		white-space: pre-wrap;
	}

	.result-toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.meta {
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.meta-toggle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: var(--text-muted);
		cursor: pointer;
	}

	.result-pane {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
		line-height: 1.45;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
		white-space: pre;
		overflow: auto;
		flex: 1;
		min-height: 280px;
		max-height: min(70vh, 640px);
		margin: 0;
	}

	.result-pane.error {
		background: #fef2f2;
		color: #991b1b;
		border-color: #fecaca;
		white-space: pre-wrap;
	}

	:global([data-theme='dark']) .result-pane.error {
		background: #3a1818;
		color: #fca5a5;
		border-color: #5b2424;
	}

	.placeholder {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
		padding: 10px 12px;
		border: 1px dashed var(--border);
		border-radius: 4px;
		min-height: 280px;
		margin: 0;
		flex: 1;
	}

	.table-wrap {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		padding: 0;
		white-space: normal;
	}

	.result-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}

	.result-table th {
		text-align: left;
		padding: 6px 10px;
		font-weight: 600;
		color: var(--text-muted);
		background: var(--bg-card);
		border-bottom: 2px solid var(--border);
		position: sticky;
		top: 0;
		white-space: nowrap;
	}

	.result-table td {
		padding: 4px 10px;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
		font-variant-numeric: tabular-nums;
		word-break: break-word;
		max-width: 320px;
	}

	.result-table tr:hover td {
		background: var(--hover-bg);
	}

	@media (max-width: 960px) {
		.pipeline-label {
			width: 5.5rem;
			padding: 8px 10px;
		}

		.pipeline-cell {
			padding: 8px 10px;
		}
	}
</style>
