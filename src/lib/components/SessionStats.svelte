<script lang="ts">
	import type { PressureResponse } from '$data/lib/drawtab-loader.js';
	import {
		estimateP00,
		estimateP100,
		interpolatePhysical,
		fmtP,
	} from '$data/lib/pressure/interpolate.js';

	let {
		sessions,
		title = 'Aggregated Stats',
		excludedNote = '',
	}: { sessions: PressureResponse[]; title?: string; excludedNote?: string } = $props();

	const MARKS = [
		{ label: 'P00 (IAF)', kind: 'p00' as const },
		{ label: 'P25', pct: 25 },
		{ label: 'P50 (median)', pct: 50 },
		{ label: 'P75', pct: 75 },
		{ label: 'P100 (Max)', kind: 'p100' as const },
	];

	function valueFor(s: PressureResponse, m: { kind?: 'p00' | 'p100'; pct?: number }) {
		if (m.kind === 'p00') return estimateP00(s.Records);
		if (m.kind === 'p100') return estimateP100(s.Records);
		return interpolatePhysical(s.Records, m.pct!);
	}

	function aggregate(values: (number | null)[]) {
		const xs = values.filter((v): v is number => v !== null && isFinite(v)).sort((a, b) => a - b);
		if (xs.length === 0) return { min: null, median: null, max: null };
		const min = xs[0];
		const max = xs[xs.length - 1];
		const mid = Math.floor(xs.length / 2);
		const median = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
		return { min, median, max };
	}

	let rows = $derived(
		MARKS.map((m) => ({
			label: m.label,
			...aggregate(sessions.map((s) => valueFor(s, m))),
		})),
	);
</script>

<div class="stats">
	<h3>{title}</h3>
	<table>
		<thead>
			<tr>
				<th>Mark</th>
				<th class="num">Min<br /><span class="unit">(gf)</span></th>
				<th class="num">Median<br /><span class="unit">(gf)</span></th>
				<th class="num">Max<br /><span class="unit">(gf)</span></th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.label)}
				<tr>
					<td><strong>{r.label}</strong></td>
					<td class="num mono">{fmtP(r.min)}</td>
					<td class="num mono">{fmtP(r.median)}</td>
					<td class="num mono">{fmtP(r.max)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if excludedNote}
		<p class="excluded">⚠ {excludedNote}</p>
	{/if}
	<p class="meta">
		Aggregates across {sessions.length} session{sessions.length === 1 ? '' : 's'}.
	</p>
</div>

<style>
	.stats {
		margin: 16px 0;
	}
	h3 {
		margin: 0 0 8px;
		font-size: 14px;
		font-weight: 600;
	}
	table {
		border-collapse: collapse;
		font-size: 13px;
	}
	thead th {
		padding: 4px 14px;
		text-align: left;
		border-bottom: 2px solid var(--border);
		color: var(--text-muted);
		font-weight: 600;
	}
	thead th.num {
		text-align: right;
	}
	tbody td {
		padding: 4px 14px;
		border-bottom: 1px solid var(--border);
	}
	.num {
		text-align: right;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.unit {
		font-size: 11px;
		font-weight: 400;
		color: var(--text-muted);
	}
	.excluded {
		margin: 6px 0 0;
		font-size: 12px;
		color: #b45309;
	}
	.meta {
		margin: 6px 0 0;
		font-size: 12px;
		color: var(--text-muted);
	}
</style>
