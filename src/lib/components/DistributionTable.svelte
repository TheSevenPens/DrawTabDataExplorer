<script lang="ts">
	interface Row {
		label: string | number;
		count: number;
	}

	let {
		labelHeader,
		rows,
		total,
		formatLabel = (l: string | number) => String(l),
		labelClass = 'label',
	}: {
		/** Column header text for the first column (e.g. "Brightness (cd/m²)", "Panel Tech"). */
		labelHeader: string;
		rows: Row[];
		/** Denominator for the percentage. Defaults to the sum of row counts. */
		total?: number;
		/** Optional formatter for the label cell (e.g. number → locale string). */
		formatLabel?: (label: string | number) => string;
		/** Extra class on the label `<td>`. Defaults to `label`; use e.g. `'label mono'` for monospace. */
		labelClass?: string;
	} = $props();

	let denom = $derived(total ?? rows.reduce((s, r) => s + r.count, 0));
</script>

<table class="stat-table">
	<thead>
		<tr>
			<th>{labelHeader}</th>
			<th>Count</th>
			<th></th>
		</tr>
	</thead>
	<tbody>
		{#each rows as row (row.label)}
			{@const pctVal = denom === 0 ? '0.0' : ((row.count / denom) * 100).toFixed(1)}
			<tr>
				<td class={labelClass}>{formatLabel(row.label)}</td>
				<td class="count">{row.count}</td>
				<td class="bar-cell">
					<div class="bar-bg"><div class="bar-fill" style="width:{pctVal}%"></div></div>
					<span class="pct">{pctVal}%</span>
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	/* The shared distribution-table styling. `:global()` so bespoke tables on
		 the analysis / data-quality pages that still use `.stat-table` markup
		 directly (aspect-ratio with extra columns, etc.) continue to look the
		 same. Once those are migrated this can shed the :global wrapper. */
	:global(.stat-table) {
		border-collapse: collapse;
		font-size: 13px;
		width: 100%;
	}
	:global(.stat-table th) {
		text-align: left;
		padding: 5px 10px;
		background: var(--th-bg);
		color: var(--th-text);
		border-bottom: 1px solid var(--border);
	}
	:global(.stat-table td) {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}
	:global(.stat-table tr:hover td) {
		background: var(--hover-bg);
	}
	:global(.stat-table .label) {
		font-weight: 600;
	}
	:global(.stat-table .decimal) {
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
		width: 60px;
	}
	:global(.stat-table .count) {
		color: var(--text-muted);
		width: 50px;
	}
	:global(.stat-table .bar-cell) {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	:global(.bar-bg) {
		width: 120px;
		height: 12px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
		flex-shrink: 0;
	}
	:global(.bar-fill) {
		height: 100%;
		background: #2563eb;
		border-radius: 3px;
	}
	:global(.stat-table .pct) {
		font-size: 12px;
		color: var(--text-dim);
		white-space: nowrap;
	}
	:global(.stat-table .mono) {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
</style>
