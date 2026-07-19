<script lang="ts">
	// Maps OpenTabletDriver config names to our tablet EntityIds. Wacom for now;
	// matching (model number + active-area size) lives in $lib/otd-entity-match.
	import EntityLink from '$lib/components/EntityLink.svelte';
	import type { OtdEntityMatchRow } from '$lib/otd-entity-match.js';

	let { matches }: { matches: OtdEntityMatchRow[] } = $props();

	const matched = $derived(matches.filter((m) => m.entityId));
	const counts = $derived({
		total: matches.length,
		matched: matched.length,
		idArea: matches.filter((m) => m.basis === 'id+area').length,
		id: matches.filter((m) => m.basis === 'id').length,
		area: matches.filter((m) => m.basis === 'area').length,
		none: matches.filter((m) => m.basis === 'none').length,
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
		> config to our tablet entity, matched by model number and digitizer active-area size. Wacom only
		for now.
	</p>
	<p class="meta">
		{counts.matched}/{counts.total} matched · <strong>id+area</strong>
		{counts.idArea} ·
		<strong>id</strong>
		{counts.id} · <strong>area</strong>
		{counts.area}
		{#if counts.none}· <strong>unmatched</strong> {counts.none}{/if}
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
					{#each matches as m (m.otdName)}
						<tr class:unmatched={!m.entityId}>
							<td>{m.otdName}</td>
							<td>
								{#if m.entityId}
									<EntityLink entityId={m.entityId}>{m.modelId}</EntityLink>
								{:else}
									<span class="dim">—</span>
								{/if}
							</td>
							<td>{m.fullName ?? '—'}</td>
							<td>
								{#if m.basis !== 'none'}
									<span class="badge basis-{m.basis.replace('+', '-')}">{m.basis}</span>
								{:else}
									<span class="dim">none</span>
								{/if}
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
	tr.unmatched td {
		color: var(--text-dim);
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
	/* id+area is the confident match — mark it with the accent edge. */
	.badge.basis-id-area {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
