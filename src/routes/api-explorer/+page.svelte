<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { DrawTabDataSet } from '$data/lib/dataset.js';
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	const dataTabs = [
		{ href: '/reference', label: 'Reference' },
		{ href: '/data-dictionary', label: 'Data Dictionary' },
		{ href: '/api-explorer', label: 'API Explorer' },
		{ href: '/data-quality', label: 'Data Quality' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/wacom-driver-compat', label: 'Driver Compat' },
	];

	interface Preset {
		label: string;
		body: string;
	}

	const presets: Preset[] = [
		{
			label: 'Top 5 newest Wacom pen displays',
			body: `return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .filter('ModelType', '==', 'PENDISPLAY')
  .sort('ModelLaunchYear', 'desc')
  .take(5)
  .toArray();`,
		},
		{
			label: 'Find a tablet by Model.Id',
			body: `return await ds.Tablets.find(t => t.Model.Id === 'PTH-660');`,
		},
		{
			label: 'Compatible pens for a tablet (record-method API)',
			body: `const t = await ds.Tablets.find(t => t.Model.Id === 'PL-550');
return await t.getCompatiblePens();`,
		},
		{
			label: 'Tablet family + its members',
			body: `const t = await ds.Tablets.find(t => t.Model.Id === 'PL-550');
const family = await t.getFamily();
const members = await family.getTablets();
return { family: family.FamilyName, count: members.length, members: members.map(m => m.Model.Id) };`,
		},
		{
			label: 'Reverse compatibility (pen → tablets)',
			body: `const pen = await ds.Pens.find(p => p.PenId === 'UP-911E');
const tablets = await pen.getCompatibleTablets();
return tablets.map(t => t.Meta.EntityId);`,
		},
		{
			label: 'Count tablets per brand',
			body: `return await ds.Tablets
  .summarize({ by: 'Brand', count: 'tablets' })
  .sort('tablets', 'desc')
  .toArray();`,
		},
		{
			label: 'Count tablets per brand and type',
			body: `// Multi-field grouping — one row per (Brand, ModelType) pair.
return await ds.Tablets
  .summarize({ by: ['Brand', 'ModelType'], count: 'tablets' })
  .sort('tablets', 'desc')
  .toArray();`,
		},
		{
			label: 'Wacom launch-year stats (avg/min/max)',
			body: `return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .summarize({
    by: 'Brand',
    count: 'tablets',
    avg: { avgYear: 'ModelLaunchYear' },
    min: { firstYear: 'ModelLaunchYear' },
    max: { lastYear: 'ModelLaunchYear' },
  })
  .toArray();`,
		},
		{
			label: 'Pressure-response session lookup',
			body: `const session = await ds.PressureResponse.find(s => s.InventoryId === 'WAP.0001');
const pen = await session.getPen();
const tablet = await session.getTablet();
return { session: session.InventoryId, pen: pen?.PenId, tablet: tablet?.Model.Id };`,
		},
		{
			label: 'Brand → its tablets and pens',
			body: `const brand = await ds.Brands.find(b => b.BrandId === 'WACOM');
const tablets = await brand.getTablets();
const pens = await brand.getPens();
return { tablets: tablets.length, pens: pens.length };`,
		},
		{
			label: 'Inventory: getPen() on first inventory record',
			body: `const inv = await ds.InventoryPens.find(() => true);
const pen = await inv.getPen();
return { inventoryId: inv.InventoryId, pen: pen?.PenId };`,
		},
	];

	function renderPreset(p: Preset): string {
		return `// ${p.label}\n${p.body}`;
	}

	let code = $state(renderPreset(presets[0]));
	let result = $state<unknown>(undefined);
	let resultJson = $state<string>('');
	let error = $state<string | null>(null);
	let running = $state(false);
	let elapsedMs = $state<number | null>(null);

	let ds = $state<DrawTabDataSet | null>(null);

	onMount(() => {
		ds = new DrawTabDataSet({ kind: 'url', baseUrl: base, userId: 'sevenpens' });
	});

	async function runQuery() {
		if (!ds) return;
		running = true;
		error = null;
		result = undefined;
		resultJson = '';
		elapsedMs = null;
		const start = performance.now();
		try {
			// User code is treated as the body of an async function, with `ds`
			// in scope. The body is expected to `return` a value.
			const fn = new Function('ds', `return (async () => { ${code} })()`);
			const out = await (fn as (d: DrawTabDataSet) => Promise<unknown>)(ds);
			result = out;
			resultJson = formatResult(out);
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
		resultJson = '';
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

	function handleKeyDown(e: KeyboardEvent) {
		// Ctrl/Cmd+Enter runs the query.
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			runQuery();
		}
	}
</script>

<Nav />
<SubNav tabs={dataTabs} />
<h1>API Explorer</h1>

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
				{#each presets as p (p.label)}
					<option value={p.label}>{p.label}</option>
				{/each}
			</select>
		</div>
		<textarea id="api-code" bind:value={code} onkeydown={handleKeyDown} spellcheck="false" rows="12"
		></textarea>
		<div class="run-row">
			<button class="run-btn" onclick={runQuery} disabled={running || !ds}>
				{running ? 'Running…' : 'Run'}
			</button>
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
				<button class="copy-btn" onclick={copyResult}>Copy</button>
			{/if}
		</div>
		{#if error}
			<pre class="result-pane error">{error}</pre>
		{:else if resultJson}
			<pre class="result-pane">{resultJson}</pre>
		{:else if running}
			<p class="placeholder">Running…</p>
		{:else}
			<p class="placeholder">Press Run (or Ctrl+Enter) to execute.</p>
		{/if}
	</div>
</div>

<details class="ref">
	<summary>Quick API reference</summary>
	<p>Collections (each returns a <code>Query&lt;T&gt;</code>):</p>
	<ul class="cols">
		<li><code>ds.Brands</code></li>
		<li><code>ds.Tablets</code></li>
		<li><code>ds.TabletFamilies</code></li>
		<li><code>ds.Pens</code></li>
		<li><code>ds.PenFamilies</code></li>
		<li><code>ds.Drivers</code></li>
		<li><code>ds.PenCompat</code></li>
		<li><code>ds.PressureResponse</code></li>
		<li><code>ds.InventoryPens</code></li>
		<li><code>ds.InventoryTablets</code></li>
	</ul>
	<p>Query methods:</p>
	<ul class="cols">
		<li><code>.filter(field, op, value)</code></li>
		<li><code>.sort(field, 'asc' | 'desc')</code></li>
		<li><code>.take(n)</code></li>
		<li><code>.summarize(spec)</code></li>
		<li><code>.toArray()</code></li>
		<li><code>.find(predicate)</code></li>
		<li><code>.count()</code></li>
	</ul>
	<p>
		<code>.summarize(spec)</code> groups rows and returns one row per group. After it, subsequent
		<code>.sort()</code>
		/ <code>.filter()</code> / <code>.take()</code> target the groupBy keys and aggregator output columns.
	</p>
	<ul class="ops">
		<li>
			<code>by</code> — field key or array of field keys to group by; omit for a single all-rows summary.
		</li>
		<li>
			<code>count</code> — <code>true</code> adds a <code>count</code> column; a string sets the column
			name.
		</li>
		<li>
			<code>sum</code> / <code>avg</code> / <code>min</code> / <code>max</code> — object map of
			<em>output column name</em> → <em>numeric field key</em>. Blank/non-numeric values are
			skipped.
		</li>
	</ul>
	<p>
		Filter operators (the <code>op</code> argument to <code>.filter()</code>):
	</p>
	<ul class="ops">
		<li><code>'=='</code>, <code>'!='</code> — exact match</li>
		<li><code>'contains'</code>, <code>'notcontains'</code> — substring (case-insensitive)</li>
		<li><code>'startswith'</code>, <code>'notstartswith'</code> — prefix (case-insensitive)</li>
		<li><code>'empty'</code>, <code>'notempty'</code> — field is missing/blank</li>
		<li>
			<code>'&gt;'</code>, <code>'&gt;='</code>, <code>'&lt;'</code>, <code>'&lt;='</code> — numeric compare
			(blanks excluded)
		</li>
	</ul>
	<p>
		Records returned from a query have relationship helpers (non-enumerable, so they don't show up
		in JSON output):
	</p>
	<ul class="cols">
		<li><code>tablet.getCompatiblePens()</code></li>
		<li><code>tablet.getFamily()</code></li>
		<li><code>tablet.getBrand()</code></li>
		<li><code>pen.getCompatibleTablets()</code></li>
		<li><code>pen.getFamily()</code></li>
		<li><code>pen.getBrand()</code></li>
		<li><code>family.getTablets()</code> / <code>family.getPens()</code></li>
		<li><code>brand.getTablets()</code> / <code>brand.getPens()</code></li>
		<li><code>session.getPen()</code> / <code>session.getTablet()</code></li>
		<li><code>inv.getPen()</code> / <code>inv.getTablet()</code></li>
	</ul>
</details>

<style>
	h1 {
		margin-bottom: 8px;
	}

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

	.run-btn {
		padding: 6px 18px;
		font-size: 13px;
		font-weight: 600;
		border: 1px solid #2563eb;
		border-radius: 4px;
		background: #2563eb;
		color: #fff;
		cursor: pointer;
	}

	.run-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.run-btn:not(:disabled):hover {
		background: #1d4ed8;
	}

	.meta {
		font-size: 12px;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
	}

	.copy-btn {
		padding: 2px 8px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
	}

	.copy-btn:hover {
		background: var(--hover-bg);
		color: var(--text);
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
		min-height: 200px;
		margin: 0;
	}

	.ref {
		margin-top: 24px;
		padding: 12px 16px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		font-size: 13px;
	}

	.ref summary {
		cursor: pointer;
		font-weight: 600;
		color: var(--text);
	}

	.ref p {
		margin: 10px 0 4px;
		color: var(--text-muted);
	}

	.ref ul.cols {
		columns: 2;
		column-gap: 24px;
		list-style: none;
		padding: 0;
		margin: 4px 0 8px;
	}

	.ref ul.ops {
		list-style: none;
		padding: 0;
		margin: 4px 0 8px;
	}

	.ref ul.ops li {
		padding: 2px 0;
	}

	@media (max-width: 700px) {
		.ref ul.cols {
			columns: 1;
		}
	}

	.ref code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 12px;
		background: rgba(0, 0, 0, 0.04);
		padding: 1px 5px;
		border-radius: 3px;
	}
</style>
