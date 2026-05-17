<script lang="ts">
	import { resolve } from '$app/paths';
	import { brandName, type PressureResponse } from '$data/lib/drawtab-loader.js';
	import {
		estimateP00,
		estimateP100,
		interpolatePhysical,
		fmtP,
	} from '$data/lib/pressure/interpolate.js';
	import { sessionEntityId } from '$data/lib/pressure/session-id.js';
	import type { DefectInfo } from '$data/lib/pressure/defects.js';

	let {
		sessions,
		colors,
		hiddenIds,
		onToggle,
		penNameById = new Map<string, string>(),
		defectsByInventoryId = new Map<string, DefectInfo>(),
		showBrand = false,
		showModel = false,
	}: {
		sessions: PressureResponse[];
		/** Color for each session, keyed by `_id`. Should match what
		 * was passed to `<PressureChart>` so swatches and lines agree. */
		colors: ReadonlyMap<string, string>;
		hiddenIds: ReadonlySet<string>;
		onToggle: (id: string) => void;
		/** PenEntityId → display label (Pen Name / Pen ID). Used when
		 * showModel is true. */
		penNameById?: ReadonlyMap<string, string>;
		defectsByInventoryId?: ReadonlyMap<string, DefectInfo>;
		showBrand?: boolean;
		showModel?: boolean;
	} = $props();

	// 17 standard percentile marks plus P00 / P100 estimate columns.
	const PCT_COLS = [1, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 99] as const;

	type Row = {
		session: PressureResponse;
		id: string;
		color: string;
		defect: DefectInfo | undefined;
		p00: number | null;
		p100: number | null;
		mid: (number | null)[];
	};

	let rows = $derived<Row[]>(
		sessions.map((s) => ({
			session: s,
			id: s._id,
			color: colors.get(s._id) ?? '#888',
			defect: defectsByInventoryId.get(s.InventoryId),
			p00: estimateP00(s.Records),
			p100: estimateP100(s.Records),
			mid: PCT_COLS.map((p) => interpolatePhysical(s.Records, p)),
		})),
	);

	let anyDefects = $derived(rows.some((r) => !!r.defect));
</script>

<div class="legend-wrap">
	<table class="legend-table">
		<thead>
			<tr>
				<th class="centered">Show</th>
				<th></th>
				{#if anyDefects}<th class="centered" title="Defective unit">⚠</th>{/if}
				{#if showBrand}<th>Brand</th>{/if}
				{#if showModel}<th>Pen</th>{/if}
				<th>Inv ID</th>
				<th>Date</th>
				<th class="num">P00</th>
				{#each PCT_COLS as p (p)}
					<th class="num">P{String(p).padStart(2, '0')}</th>
				{/each}
				<th class="num">P100</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.id)}
				<tr class:dimmed={hiddenIds.has(r.id)} class:defective={!!r.defect}>
					<td class="centered">
						<input
							type="checkbox"
							checked={!hiddenIds.has(r.id)}
							onchange={() => onToggle(r.id)}
							aria-label="Show this session on the chart"
						/>
					</td>
					<td>
						<span class="swatch" style="background: {r.color}" aria-hidden="true"></span>
					</td>
					{#if anyDefects}
						<td class="centered">
							{#if r.defect}
								<span class="defect-icon" title={r.defect.detailsLabel}>⚠</span>
							{/if}
						</td>
					{/if}
					{#if showBrand}
						<td>{brandName(r.session.Brand)}</td>
					{/if}
					{#if showModel}
						<td>
							<a href={resolve('/entity/[entityId]', { entityId: r.session.PenEntityId })}>
								{penNameById.get(r.session.PenEntityId) ?? r.session.PenEntityId}
							</a>
						</td>
					{/if}
					<td class="mono">
						<a href={resolve('/entity/[entityId]', { entityId: sessionEntityId(r.session) })}>
							{r.session.InventoryId}
						</a>
					</td>
					<td class="mono">{r.session.Date}</td>
					<td class="num mono">{fmtP(r.p00)}</td>
					{#each r.mid as v, i (i)}
						<td class="num mono">{fmtP(v)}</td>
					{/each}
					<td class="num mono">{fmtP(r.p100)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.legend-wrap {
		max-width: 100%;
		overflow-x: auto;
		margin: 16px 0;
	}
	.legend-table {
		border-collapse: collapse;
		font-size: 12px;
		white-space: nowrap;
	}
	thead th {
		padding: 4px 8px;
		text-align: left;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
		background: var(--bg-card);
		position: sticky;
		top: 0;
	}
	thead th.num {
		text-align: right;
	}
	thead th.centered {
		text-align: center;
	}
	tbody td {
		padding: 3px 8px;
		border-bottom: 1px solid var(--border);
	}
	tbody tr.dimmed {
		color: var(--text-muted);
		opacity: 0.55;
	}
	tbody tr.defective .swatch {
		opacity: 0.6;
	}
	.num {
		text-align: right;
	}
	.centered {
		text-align: center;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
	}
	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
		border: 1px solid rgba(0, 0, 0, 0.15);
		vertical-align: middle;
	}
	.defect-icon {
		color: #d97706;
		font-weight: 700;
		cursor: help;
	}
	a {
		color: var(--link);
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
</style>
