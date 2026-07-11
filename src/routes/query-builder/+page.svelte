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
	import {
		TABLET_FIELDS,
		TABLET_FIELD_GROUPS,
	} from '$data/lib/entities/tablet-fields.js';
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
		type BuilderCollection,
		type BuilderFilter,
		type BuilderOutput,
		type BuilderSort,
		type QueryBuilderTemplate,
	} from '$lib/query-builder/mockup-templates.js';
	import { buildQueryCode } from '$lib/query-builder/code-preview.js';
	import { executeBuilderQuery } from '$lib/query-builder/execute-builder-query.js';
	import { fieldOptionLabel } from '$lib/field-option-label.js';
	import type { DrawTabDataSet } from '$data/lib/dataset.js';
	import type { PipelineSection } from '$lib/query-builder/pipeline-field-drag.js';

	let { data } = $props();

	const dataTabs = dataSubNavTabs();

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
	let countByFields = $state('Brand');

	let fields = $derived(collectionMeta[collection].fields);
	let fieldGroups = $derived(collectionMeta[collection].groups);

	let output = $derived.by((): BuilderOutput => {
		if (outputMode === 'distinct') return { mode: 'distinct', field: distinctField };
		if (outputMode === 'count') return { mode: 'count' };
		if (outputMode === 'countBy') {
			const parts = countByFields
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
			return { mode: 'countBy', fields: parts.length ? parts : ['Brand'] };
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

	let sortPickerFields = $derived.by((): AnyFieldDisplayDef[] => {
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
		outputMode === 'countBy' ? [...fieldGroups, AGGREGATE_GROUP] : fieldGroups,
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
		const start = performance.now();
		try {
			result = await executeBuilderQuery(ds, {
				collection,
				filters,
				sorts,
				columns,
				skip: skip === '' ? undefined : Number(skip),
				take: take === '' ? undefined : Number(take),
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
		if (t.output.mode === 'countBy') countByFields = t.output.fields.join(', ');
		clearResult();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			runQuery();
		}
	}

	let filterFieldKeys = $derived(
		filters.filter((f) => !f.disabled).map((f) => f.field),
	);

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
		Build <code>DrawTabDataSet</code> queries without typing. Pipeline order matches the API:
		filter → columns → sort → limit → output. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs.
		Compare with <a href="/api-explorer">API Explorer</a>.
	</p>

	<div class="layout">
		<section class="builder">
			<div class="row">
				<label class="field-label" for="qb-collection">Source</label>
				<select id="qb-collection" class="select" bind:value={collection}>
					{#each COLLECTIONS as c (c)}
						<option value={c}>{c}</option>
					{/each}
				</select>
				<label class="field-label" for="qb-template">Load example</label>
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
					<option value="">Basic tier example…</option>
					{#each BASIC_TEMPLATES as t (t.label)}
						<option value={t.label}>{t.label}</option>
					{/each}
				</select>
			</div>

			<div class="block">
				<div class="block-header">
					<h2>Filters</h2>
				</div>
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
			</div>

			{#if outputMode === 'toArray'}
				<div class="block columns-block">
					<div class="block-header">
						<h2>Columns</h2>
						<div class="block-actions">
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
					</div>
					{#if columns.length === 0}
						<p class="hint columns-hint">
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
				</div>
			{/if}

			{#if outputMode === 'toArray' || outputMode === 'countBy'}
				<div class="block">
					<div class="block-header">
						<h2>Sort</h2>
					</div>
					{#if outputMode === 'countBy'}
						<p class="hint sort-hint">Sorts the grouped result (e.g. by <code>tablets</code> count).</p>
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
				</div>
			{/if}

			{#if outputMode === 'toArray'}
				<div class="block">
					<div class="block-header">
						<h2>Limit</h2>
					</div>
					<div class="row compact">
						<label class="field-label" for="qb-skip">Skip</label>
						<input id="qb-skip" class="input narrow" type="number" min="0" bind:value={skip} />
						<label class="field-label" for="qb-take">Take</label>
						<input id="qb-take" class="input narrow" type="number" min="0" bind:value={take} />
					</div>
				</div>
			{/if}

			<div class="block">
				<div class="block-header">
					<h2>Output</h2>
				</div>
				<p class="hint">Terminal step — what the pipeline returns.</p>
				<SegmentedControl
					options={[
						{ value: 'toArray', label: 'Rows' },
						{ value: 'distinct', label: 'Distinct' },
						{ value: 'countBy', label: 'Count by' },
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
					<div class="row compact">
						<label class="field-label" for="qb-countby">Group by (comma-separated keys)</label>
						<input id="qb-countby" class="input wide" bind:value={countByFields} />
					</div>
				{/if}
			</div>

			<details class="block query-code">
				<summary>Generated query</summary>
				<p class="hint query-code-hint">
					API Explorer runs this as the body of an async function with <code>ds</code> in scope.
					<a href="/api-explorer">Open API Explorer</a> to paste and experiment.
				</p>
				<div class="query-code-toolbar">
					<Button variant="subtle" size="sm" onclick={copyQueryCode}>Copy</Button>
				</div>
				<pre class="code"><code>{codePreview}</code></pre>
			</details>
		</section>

		<aside class="preview">
			<div class="block-header">
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
					{#if resultJson}
						<label
							class="meta-toggle"
							title="Show loader-internal Meta._id, _CreateDate, _ModifiedDate fields"
						>
							<input type="checkbox" bind:checked={showMeta} />
							Show meta
						</label>
						<SegmentedControl
							options={[
								{ value: 'json', label: 'JSON' },
								{ value: 'table', label: 'Table' },
							]}
							bind:value={viewMode}
							ariaLabel="Result view"
						/>
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
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
		gap: 20px;
		align-items: start;
	}

	.builder,
	.preview {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.preview {
		position: sticky;
		top: 12px;
		min-height: 360px;
		display: flex;
		flex-direction: column;
	}

	.block {
		border: 1px solid var(--border-light);
		border-radius: 8px;
		padding: 12px;
		background: var(--bg-card);
	}

	.query-code {
		margin-top: 4px;
	}

	.query-code > summary {
		cursor: pointer;
		font-size: 15px;
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
		max-height: 280px;
		min-height: 0;
	}

	.preview-label {
		font-weight: 600;
		font-size: 15px;
		color: var(--text);
	}

	.block-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
	}

	.block-header h2 {
		margin: 0;
		font-size: 15px;
	}

	.block-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	.row.compact {
		margin-top: 10px;
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

	.select.wide,
	.input.wide {
		min-width: 220px;
		flex: 1;
	}

	.input.narrow {
		width: 88px;
	}

	.hint {
		margin: 0;
		font-size: 13px;
		color: var(--text-dim);
	}

	.columns-hint {
		margin-bottom: 8px;
	}

	.sort-hint {
		margin-bottom: 8px;
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
		.layout {
			grid-template-columns: 1fr;
		}

		.preview {
			position: static;
		}
	}
</style>
