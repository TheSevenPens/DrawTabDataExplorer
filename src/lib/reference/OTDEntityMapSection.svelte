<script lang="ts">
	// Maps OpenTabletDriver config names to our tablet EntityIds across brands.
	// Matching (model number, marketing name, active-area size) lives in
	// $lib/otd-entity-match. Unmatched OTD configs (no entity) are not listed.
	import EntityLink from '$lib/components/EntityLink.svelte';
	import { isHighConfidence, type OtdEntityMatchRow } from '$lib/otd-entity-match.js';

	let { matches }: { matches: OtdEntityMatchRow[] } = $props();

	const matched = $derived(matches.filter((m) => m.entityId));
	const n = (basis: string) => matches.filter((m) => m.basis === basis).length;
	const counts = $derived({
		total: matches.length,
		matched: matched.length,
		high: matches.filter((m) => isHighConfidence(m.basis)).length,
		idArea: n('id+area'),
		nameArea: n('name+area'),
		id: n('id'),
		name: n('name'),
		none: n('none'),
	});

	const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
	function area(w: number | null, h: number | null): string {
		const rw = round1(w);
		const rh = round1(h);
		return rw != null && rh != null ? `${rw} × ${rh}` : '—';
	}
</script>

<section>
	<div class="section-header">
		<h2>OTD To Tablet Entity</h2>
	</div>
	<p class="meta">
		Maps each <a
			href="https://github.com/OpenTabletDriver/OpenTabletDriver"
			target="_blank"
			rel="noopener">OpenTabletDriver</a
		>
		config to our tablet entity, matched by model number, marketing name, and digitizer active-area size.
		<strong>id+area</strong>
		and <strong>name+area</strong> (a name/id match confirmed by size) are the high-confidence bases.
	</p>
	<p class="meta">
		{counts.matched} matched ({counts.high} high-confidence) of {counts.total} configs · id+area
		{counts.idArea} · name+area {counts.nameArea} · id {counts.id} · name {counts.name}
		{#if counts.none}· {counts.none} unmatched (not shown){/if}
	</p>

	{#if matches.length}
		<div class="table-wrap">
			<table class="ref-table">
				<thead>
					<tr>
						<th>OTD Name</th>
						<th>Tablet Entity</th>
						<th>Tablet Full Name</th>
						<th>Basis</th>
						<th>OTD Area (mm)</th>
						<th>Our Area (mm)</th>
					</tr>
				</thead>
				<tbody>
					{#each matched as m (m.otdName)}
						<tr>
							<td>{m.otdName}</td>
							<td>
								<EntityLink entityId={m.entityId!}>{m.modelId}</EntityLink>
							</td>
							<td>{m.fullName ?? '—'}</td>
							<td>
								<span class="badge basis-{m.basis.replace('+', '-')}">{m.basis}</span>
							</td>
							<td class="mono">{area(m.otdWidthMM, m.otdHeightMM)}</td>
							<td class="mono">{area(m.ourWidthMM, m.ourHeightMM)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="meta">No OTD reference data available.</p>
	{/if}
</section>

<style>
	.section-header {
		margin-bottom: 8px;
	}
	h2 {
		font-size: var(--type-heading);
		font-weight: 600;
		color: var(--text);
	}
	.meta {
		margin: 0 0 6px;
		color: var(--text-muted);
		font-size: var(--type-caption);
	}
	.meta strong {
		color: var(--text);
		font-weight: 600;
	}
	.table-wrap {
		overflow-x: auto;
		margin-top: 8px;
	}
	.mono {
		font-family: ui-monospace, 'Cascadia Mono', Menlo, monospace;
		color: var(--text-muted);
	}
	.badge {
		display: inline-block;
		padding: 1px 6px;
		font-size: var(--type-micro);
		letter-spacing: var(--track-wide);
		text-transform: uppercase;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text-muted);
	}
	/* The high-confidence bases (name/id confirmed by size) get the accent edge. */
	.badge.basis-id-area,
	.badge.basis-name-area {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
