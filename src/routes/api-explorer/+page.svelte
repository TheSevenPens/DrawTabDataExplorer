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
			label: 'Brands with > 30 tablets (filter after summarize = SQL HAVING)',
			body: `// Chaining .filter() after .summarize() filters on the aggregated column —
// equivalent to SQL HAVING. Works because summarize swaps in synthetic
// field-defs over the summary rows.
return await ds.Tablets
  .summarize({ by: 'Brand', count: 'tablets' })
  .filter('tablets', '>', 30)
  .sort('tablets', 'desc')
  .toArray();`,
		},
		{
			label: 'Project to specific columns with .select()',
			body: `return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .select(['Brand', 'ModelId', 'ModelName', 'ModelLaunchYear'])
  .sort('ModelLaunchYear', 'desc')
  .take(5)
  .toArray();`,
		},
		{
			label: 'Distinct values of a field',
			body: `// .distinct() returns a sorted array of distinct non-empty values.
return await ds.Tablets.filter('Brand', '==', 'WACOM').distinct('ModelType');`,
		},
		{
			label: 'Predicate-function filter',
			body: `// .filter() also accepts an arbitrary predicate function.
// Not serialisable — use string-tuple form for saved/URL state.
return await ds.Tablets
  .filter(t => (t.Model.LaunchYear ?? 0) >= 2020 && t.Display)
  .take(5)
  .toArray();`,
		},
		{
			label: 'Boolean expression filter (OR / AND / NOT)',
			body: `// Tree-shaped filter expression — also serialisable.
return await ds.Tablets
  .filter({
    or: [
      { and: [
        { field: 'Brand', op: '==', value: 'WACOM' },
        { field: 'ModelType', op: '==', value: 'PENDISPLAY' },
      ]},
      { field: 'Brand', op: '==', value: 'XENCELABS' },
    ],
  })
  .sort('ModelLaunchYear', 'desc')
  .take(10)
  .toArray();`,
		},
		{
			label: 'Derive + summarize: tablet age buckets',
			body: `// .derive() adds computed columns usable by downstream verbs.
return await ds.Tablets
  .derive({
    decade: t => Math.floor((t.Model.LaunchYear ?? 2000) / 10) * 10,
  })
  .summarize({ by: 'decade', count: 'tablets' })
  .sort('decade', 'asc')
  .toArray();`,
		},
		{
			label: 'Join: PenCompat × Pens (inner) for a tablet',
			body: `// Inner join merges right-side columns into matched rows.
return await ds.PenCompat
  .filter('TabletId', '==', 'PL-550')
  .join(ds.Pens, 'PenId', 'PenId')
  .toArray();`,
		},
		{
			label: 'Semijoin: pens compatible with a tablet (no col merge)',
			body: `// .semijoin() keeps left rows that have a match — same shape as left.
// Equivalent to tablet.getCompatiblePens() but expressed as a verb.
return await ds.Pens
  .semijoin(ds.PenCompat.filter('TabletId', '==', 'PL-550'), 'PenId', 'PenId')
  .toArray();`,
		},
		{
			label: 'Pagination: skip + take',
			body: `// Page 3 (rows 11-15) of Wacom tablets by launch year.
return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .sort('ModelLaunchYear', 'desc')
  .skip(10)
  .take(5)
  .toArray();`,
		},
		{
			label: 'Multi-key sort (primary-by-first)',
			body: `// Array form: primary by Brand asc, secondary by year desc.
return await ds.Tablets
  .filterIn('Brand', ['WACOM', 'HUION', 'XPPEN'])
  .sort([
    { field: 'Brand', direction: 'asc' },
    { field: 'ModelLaunchYear', direction: 'desc' },
  ])
  .take(15)
  .toArray();`,
		},
		{
			label: 'filterIn: brand is one of a set',
			body: `return await ds.Tablets
  .filterIn('Brand', ['WACOM', 'XENCELABS'])
  .summarize({ by: 'Brand', count: 'tablets' })
  .toArray();`,
		},
		{
			label: 'between operator: launch year range',
			body: `return await ds.Tablets
  .filter('ModelLaunchYear', 'between', '2018|2022')
  .summarize({ by: 'Brand', count: 'tablets' })
  .sort('tablets', 'desc')
  .toArray();`,
		},
		{
			label: 'antijoin: pens with no compatible tablet (data-quality)',
			body: `// Pens that don't appear in any PenCompat row.
return await ds.Pens
  .antijoin(ds.PenCompat, 'PenId', 'PenId')
  .select(['Brand', 'PenId', 'PenName'])
  .toArray();`,
		},
		{
			label: 'leftjoin: every pen + its compat tablets (if any)',
			body: `return await ds.Pens
  .filter('Brand', '==', 'WACOM')
  .leftjoin(ds.PenCompat, 'PenId', 'PenId')
  .select(['PenId', 'TabletId'])
  .take(15)
  .toArray();`,
		},
		{
			label: 'unroll: explode alternate names',
			body: `// Lift the nested array via derive, then unroll to one row per name.
return await ds.Tablets
  .filter('Brand', '==', 'WACOM')
  .derive({ name: t => t.Model.AlternateNames ?? [] })
  .unroll('name')
  .select(['ModelId', 'name'])
  .take(15)
  .toArray();`,
		},
		{
			label: 'concat: combine two filtered queries',
			body: `// All Wacom + all Apple tablets, side by side.
return await ds.Tablets.filter('Brand', '==', 'WACOM')
  .concat(ds.Tablets.filter('Brand', '==', 'APPLE'))
  .count();`,
		},
		{
			label: 'keyBy: lookup tablets by ModelId',
			body: `const byId = await ds.Tablets.keyBy('ModelId');
return byId['PL-550'];`,
		},
		{
			label: 'Strict (case-sensitive) contains',
			body: `// Default contains is case-insensitive. The *Strict variants are exact.
return {
  caseInsensitive: await ds.Tablets.filter('ModelName', 'contains', 'CINTIQ').count(),
  caseSensitive: await ds.Tablets.filter('ModelName', 'containsStrict', 'CINTIQ').count(),
};`,
		},
		{
			label: 'Median launch year per brand (with collect)',
			body: `return await ds.Tablets
  .summarize({
    by: 'Brand',
    count: 'tablets',
    median: { medianYear: 'ModelLaunchYear' },
    distinctCount: { distinctTypes: 'ModelType' },
  })
  .sort('tablets', 'desc')
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
		<li><code>.filter(expr)</code> — boolean tree</li>
		<li><code>.filter(item =&gt; ...)</code> — predicate fn</li>
		<li><code>.filterIn(field, values)</code></li>
		<li><code>.filterNotIn(field, values)</code></li>
		<li><code>.sort(field, 'asc' | 'desc')</code></li>
		<li><code>.sort([{'{ field, direction }'}, ...])</code></li>
		<li><code>.take(n)</code></li>
		<li><code>.skip(n)</code></li>
		<li><code>.last(n)</code></li>
		<li><code>.reverse()</code></li>
		<li><code>.select(fields)</code></li>
		<li><code>.derive(cols)</code></li>
		<li><code>.unroll(field)</code></li>
		<li><code>.summarize(spec)</code></li>
		<li><code>.join(other, lKey, rKey)</code></li>
		<li><code>.semijoin(other, lKey, rKey)</code></li>
		<li><code>.antijoin(other, lKey, rKey)</code></li>
		<li><code>.leftjoin(other, lKey, rKey)</code></li>
		<li><code>.concat(other)</code> / <code>.union(other)</code></li>
		<li><code>.distinct(field)</code></li>
		<li><code>.values(field)</code></li>
		<li><code>.keyBy(field)</code></li>
		<li><code>.collectBy(field)</code></li>
		<li><code>.toArray()</code></li>
		<li><code>.find(predicate)</code></li>
		<li><code>.count()</code></li>
	</ul>
	<p>
		<code>.summarize(spec)</code> groups rows and returns one row per group. After it, subsequent
		<code>.sort()</code>
		/ <code>.filter()</code> / <code>.take()</code> target the groupBy keys and aggregator output
		columns — <code>.filter()</code> after <code>.summarize()</code> is effectively SQL
		<code>HAVING</code>.
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
			<code>sum</code> / <code>avg</code> / <code>min</code> / <code>max</code> /
			<code>median</code>
			— object map of <em>output column name</em> → <em>numeric field key</em>. Blank/non-numeric
			values are skipped.
		</li>
		<li><code>distinctCount</code> — distinct non-empty value count per group.</li>
		<li>
			<code>first</code> / <code>last</code> — raw value of the first / last item per group in input order
			(includes empties).
		</li>
		<li><code>collect</code> — array of all raw values per group, in input order.</li>
	</ul>
	<p>
		<code>.select(fields)</code> projects each row to the listed fields. Downstream
		<code>.sort()</code> / <code>.filter()</code> / <code>.take()</code> work on the projected
		columns.
		<code>.distinct(field)</code> and its synonym <code>.values(field)</code> return a sorted array of
		distinct non-empty values.
	</p>
	<p>
		<code>.filter()</code> accepts three forms: a flat <code>(field, op, value)</code> tuple, a
		boolean expression tree (with <code>or</code> / <code>and</code> / <code>not</code> keys) for nested
		conditions, and an arbitrary predicate function. The predicate-fn form is not serialisable and is
		dropped by URL state / saved views.
	</p>
	<p>
		<code>.derive(cols)</code> takes an object whose keys are new column names and whose values are
		functions of the row. Computed columns are usable by downstream
		<code>.summarize()</code> / <code>.sort()</code> / <code>.filter()</code>. Also not
		serialisable.
	</p>
	<p>
		<code>.join(other, leftKey, rightKey)</code> is an inner join that merges right-side columns
		into matched rows. <code>.semijoin(other, leftKey, rightKey)</code> keeps left rows that have a
		match without merging — row shape stays as the left side. <code>.antijoin()</code> is the
		inverse of semijoin (keeps left rows with no match — useful for data-quality patterns).
		<code>.leftjoin()</code> keeps all left rows; unmatched rows pass through without right-side
		fields. All four resolve the right-side Query lazily at
		<code>.toArray()</code> time.
	</p>
	<p>
		<code>.skip(n)</code> drops the first n rows; <code>.last(n)</code> keeps the trailing n;
		<code>.reverse()</code> flips order without re-sorting.
		<code>.sort([...])</code> takes an array form for multi-key sorts (primary-by-first, matching
		SQL <code>ORDER BY</code>); chained <code>.sort()</code> calls compose via stable sort but with
		the <em>last</em> call as primary — prefer the array form for multi-key sorts.
	</p>
	<p>
		<code>.filterIn(field, values)</code> / <code>.filterNotIn()</code> are sugar over an OR tree of
		<code>==</code>
		clauses. <code>.unroll(field)</code> explodes a top-level array-valued column into one row per
		element (use <code>.derive()</code> first to lift nested arrays). <code>.concat(other)</code> /
		<code>.union(other)</code>
		append rows (UNION ALL — chain <code>.distinct()</code> for dedup). <code>.keyBy(field)</code>
		and
		<code>.collectBy(field)</code> are async terminals returning a <code>Record</code> keyed by the field
		value (single row vs array of rows per key).
	</p>
	<p>
		Filter operators (the <code>op</code> argument to <code>.filter()</code>):
	</p>
	<ul class="ops">
		<li><code>'=='</code>, <code>'!='</code> — exact match</li>
		<li><code>'contains'</code>, <code>'notcontains'</code> — substring (case-insensitive)</li>
		<li><code>'startswith'</code>, <code>'notstartswith'</code> — prefix (case-insensitive)</li>
		<li>
			<code>'containsStrict'</code>, <code>'notcontainsStrict'</code>,
			<code>'startswithStrict'</code>, <code>'notstartswithStrict'</code> — case-sensitive variants
		</li>
		<li>
			<code>'in'</code>, <code>'notin'</code> — set membership; value is pipe-separated (e.g.
			<code>'WACOM|HUION'</code>)
		</li>
		<li>
			<code>'between'</code> — inclusive numeric range; value is pipe-separated <code>'lo|hi'</code>
		</li>
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
