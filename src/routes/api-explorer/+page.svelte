<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { DrawTabDataSet } from '$data/lib/dataset.js';
	import ChromeLayout from '$lib/components/ChromeLayout.svelte';
	import QuickApiReference from '$lib/components/QuickApiReference.svelte';
	import { dataSubNavTabs } from '$lib/nav/subnav-tabs.js';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';
	import Button from '$lib/components/Button.svelte';
	import SegmentedControl from '$lib/components/SegmentedControl.svelte';
	import {
		type Preset,
		presets,
		renderPreset,
		buildGroupedPresets,
	} from '$lib/api-explorer/presets.js';
	import { buildTableShape, stripMetaNoise } from '$lib/api-explorer/result-table.js';

	const dataTabs = dataSubNavTabs();

	const groupedPresets = buildGroupedPresets();

	let code = $state(renderPreset(presets[0]));
	let result = $state<unknown>(undefined);
	let error = $state<string | null>(null);
	let running = $state(false);
	let elapsedMs = $state<number | null>(null);

	// NOTE: /api-explorer intentionally constructs its OWN DrawTabDataSet here
	// rather than using the session-scoped `ds` from `+layout.ts` via
	// `parent().ds` (the normal pattern — see CLAUDE.md "One DataSet per
	// session"). This route is an interactive sandbox: it demonstrates and runs
	// arbitrary `DrawTabDataSet` queries, so it deliberately owns a fresh, clearly
	// scoped instance. Do NOT copy this exception into regular data pages.
	let ds = $state<DrawTabDataSet | null>(null);

	onMount(() => {
		ds = new DrawTabDataSet({ kind: 'url', baseUrl: base, userId: 'sevenpens' });
	});

	async function runQuery() {
		if (!ds) return;
		running = true;
		error = null;
		result = undefined;
		elapsedMs = null;
		const start = performance.now();
		try {
			// User code is treated as the body of an async function, with `ds`
			// in scope. The body is expected to `return` a value.
			const fn = new Function('ds', `return (async () => { ${code} })()`);
			const out = await (fn as (d: DrawTabDataSet) => Promise<unknown>)(ds);
			result = out;
			elapsedMs = Math.round(performance.now() - start);
		} catch (e) {
			error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
			elapsedMs = Math.round(performance.now() - start);
		} finally {
			running = false;
		}
	}

	function formatResult(value: unknown): string {
		try {
			return JSON.stringify(value, null, 2);
		} catch (e) {
			return `<<unserializable: ${e instanceof Error ? e.message : String(e)}>>`;
		}
	}

	function loadPreset(p: Preset) {
		code = renderPreset(p);
		result = undefined;
		error = null;
		elapsedMs = null;
	}

	function copyResult() {
		if (!resultJson) return;
		navigator.clipboard.writeText(resultJson).catch(() => {});
	}

	let resultMeta = $derived.by(() => {
		if (result === undefined) return null;
		if (Array.isArray(result)) return `Array — ${result.length} item(s)`;
		if (result === null) return 'null';
		if (typeof result === 'object') return `Object — ${Object.keys(result).length} key(s)`;
		return typeof result;
	});

	let viewMode = $state<'json' | 'table'>('json');

	// Strip the loader-internal bookkeeping fields (Meta._id, top-level _id,
	// _CreateDate, _ModifiedDate) from the result for display by default.
	// Meta.EntityId stays — it's the canonical user-facing identifier.
	// Toggling `showMeta` brings them back for inspection. Applies to
	// both JSON and Table views so they stay consistent.
	let showMeta = $state(false);

	let displayResult = $derived(showMeta ? result : stripMetaNoise(result));
	let resultJson = $derived(displayResult === undefined ? '' : formatResult(displayResult));
	let tableShape = $derived(displayResult === undefined ? null : buildTableShape(displayResult));

	// Headers + rows shaped for ExportTableButton. Only meaningful when
	// tableShape is one of the renderable kinds; null otherwise so the
	// button can be omitted.
	let exportTable = $derived.by<{ headers: string[]; rows: (string | number)[][] } | null>(() => {
		if (!tableShape || tableShape.kind === 'not-tabular') return null;
		const headers: string[] = [...tableShape.columns];
		const rows = tableShape.rows.map((r) => {
			const rec = r as Record<string, string>;
			return headers.map((h) => rec[h] ?? '');
		});
		return { headers, rows };
	});

	function handleKeyDown(e: KeyboardEvent) {
		// Ctrl/Cmd+Enter runs the query.
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			runQuery();
		}
	}
</script>

<ChromeLayout subNavTabs={dataTabs}>
	<h1 class="sr-only">API Explorer</h1>

	<p class="blurb">
		Interactive playground for the
		<code>DrawTabDataSet</code> API (defined in
		<code>data-repo/lib/dataset.ts</code>). Your code runs as the body of an async function with
		<code>ds</code>
		in scope — return a value to see it.
		<kbd>Ctrl</kbd>+<kbd>Enter</kbd> runs.
	</p>

	<div class="explorer">
		<div class="editor-panel">
			<div class="panel-header">
				<label for="api-code">Query</label>
				<select
					class="preset-select"
					onchange={(e) => {
						const sel = e.currentTarget as HTMLSelectElement;
						const p = presets.find((p) => p.label === sel.value);
						if (p) loadPreset(p);
						sel.value = '';
					}}
				>
					<option value="">Load example…</option>
					{#each groupedPresets as g (g.group)}
						<optgroup label={g.group}>
							{#each g.presets as p (p.label)}
								<option value={p.label}>{p.label}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>
			<textarea
				id="api-code"
				bind:value={code}
				onkeydown={handleKeyDown}
				spellcheck="false"
				rows="12"
			></textarea>
			<div class="run-row">
				<Button variant="primary" size="md" onclick={runQuery} disabled={running || !ds}>
					{running ? 'Running…' : 'Run'}
				</Button>
				{#if elapsedMs !== null}
					<span class="meta">{elapsedMs} ms</span>
				{/if}
				{#if resultMeta}
					<span class="meta">{resultMeta}</span>
				{/if}
			</div>
		</div>

		<div class="result-panel">
			<div class="panel-header">
				<span class="label">Result</span>
				{#if resultJson}
					<label
						class="meta-toggle"
						title="Show loader-internal Meta._id, _CreateDate, _ModifiedDate fields"
					>
						<input type="checkbox" bind:checked={showMeta} />
						Show meta fields
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
							entityType="api-explorer"
							title="API Explorer result"
							filename="api-explorer-result"
							headers={exportTable.headers}
							rows={exportTable.rows}
						/>
					{/if}
					<Button variant="subtle" onclick={copyResult}>Copy</Button>
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
				<p class="placeholder">Press Run (or Ctrl+Enter) to execute.</p>
			{/if}
		</div>
	</div>

	<QuickApiReference />
</ChromeLayout>

<style>
	.blurb {
		font-size: 13px;
		color: var(--text-muted);
		max-width: 900px;
		margin: 0 0 16px;
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

	.explorer {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
		align-items: stretch;
	}

	@media (max-width: 900px) {
		.explorer {
			grid-template-columns: 1fr;
		}
	}

	.editor-panel,
	.result-panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding-bottom: 4px;
		margin-bottom: 4px;
		border-bottom: 1px solid var(--border);
	}

	.panel-header label,
	.panel-header .label {
		font-weight: 600;
		font-size: 13px;
		color: var(--text-muted);
	}

	.preset-select {
		font-size: 12px;
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}

	textarea {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 13px;
		line-height: 1.45;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
		resize: vertical;
		min-height: 200px;
		width: 100%;
		box-sizing: border-box;
		tab-size: 2;
	}

	.run-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 8px;
	}

	.meta {
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
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
		max-height: 600px;
		min-height: 200px;
		margin: 0;
	}

	/* Theme-aware via tokens, so the per-theme override block is gone. */
	.result-pane.error {
		background: var(--danger-wash);
		color: var(--danger);
		border-color: var(--danger);
		white-space: pre-wrap;
	}

	.placeholder {
		font-size: 13px;
		color: var(--text-dim);
		font-style: italic;
		padding: 10px 12px;
		border: 1px dashed var(--border);
		border-radius: 4px;
		min-height: 200px;
		margin: 0;
	}

	.meta-toggle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: var(--text-muted);
		cursor: pointer;
		margin-right: 8px;
	}
	.meta-toggle:hover {
		color: var(--text);
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
</style>
