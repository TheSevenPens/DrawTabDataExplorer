<script lang="ts">
	// Static "Quick API reference" panel for /api-explorer (GitHub #222).
	// Pure presentational markup — no props, no state. Extracted from the
	// route so the page component stays focused on the editor/result wiring.
</script>

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
		element (use <code>.derive()</code> first to lift nested arrays). <code>.concat(other)</code>
		/
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
			<code>'between'</code> — inclusive numeric range; value is pipe-separated
			<code>'lo|hi'</code>
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
