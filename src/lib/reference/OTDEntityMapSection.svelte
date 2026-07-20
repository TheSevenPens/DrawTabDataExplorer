<script lang="ts">
	// Maps OpenTabletDriver config names to our tablet EntityIds across brands.
	// Matching (model number, marketing name, active-area size) lives in
	// $lib/otd-entity-match. Unmatched OTD configs (no entity) are not listed.
	// The Audit column is a hand-curated verdict from data/otd/otd-entity-audit.json.
	import EntityLink from '$lib/components/EntityLink.svelte';
	import {
		isHighConfidence,
		type OtdEntityMapRow,
		type AuditValue,
	} from '$lib/otd-entity-match.js';

	let { matches }: { matches: OtdEntityMapRow[] } = $props();

	const matched = $derived(matches.filter((m) => m.entityId));

	// --- Filters (client-side) ---
	let search = $state('');
	let vendor = $state('');
	let confidence = $state('');
	let basis = $state('');
	let audit = $state('');
	const vendors = $derived([...new Set(matched.map((m) => m.otdVendor))].sort());
	const bases = $derived([...new Set(matched.map((m) => m.basis))]);
	const filtered = $derived(
		matched.filter(
			(m) =>
				(vendor === '' || m.otdVendor === vendor) &&
				(confidence === '' || m.confidence === confidence) &&
				(basis === '' || m.basis === basis) &&
				(audit === '' || m.audit === audit) &&
				(search === '' ||
					`${m.otdName} ${m.fullName ?? ''}`.toLowerCase().includes(search.toLowerCase())),
		),
	);
	const n = (basis: string) => matches.filter((m) => m.basis === basis).length;
	const a = (audit: AuditValue) => matched.filter((m) => m.audit === audit).length;
	const counts = $derived({
		total: matches.length,
		matched: matched.length,
		high: matches.filter((m) => isHighConfidence(m.basis)).length,
		idArea: n('id+area'),
		nameArea: n('name+area'),
		id: n('id'),
		name: n('name'),
		none: n('none'),
		approved: a('approved'),
		rejected: a('rejected'),
		unclear: a('unclear'),
		unreviewed: a('unreviewed'),
	});

	const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);
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
		<strong>High</strong>
		confidence means a name/id match confirmed by size. Curate the
		<strong>Audit</strong> verdict on the
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="/otd-audit">audit page →</a> (writes
		<code>data/otd/otd-entity-audit.json</code>).
	</p>
	<p class="meta">
		{counts.matched} matched ({counts.high} high) of {counts.total} configs · id+area {counts.idArea}
		· name+area {counts.nameArea} · id {counts.id} · name {counts.name}
		{#if counts.none}· {counts.none} unmatched (not shown){/if}
	</p>
	<p class="meta">
		Audit: <strong>{counts.approved}</strong> approved · <strong>{counts.rejected}</strong> rejected
		·
		<strong>{counts.unclear}</strong>
		unclear · <strong>{counts.unreviewed}</strong> unreviewed
	</p>

	{#if matched.length}
		<div class="ref-filters">
			<input type="search" placeholder="Search name…" bind:value={search} />
			<select bind:value={vendor} aria-label="Filter by vendor">
				<option value="">All vendors</option>
				{#each vendors as v (v)}
					<option value={v}>{v}</option>
				{/each}
			</select>
			<select bind:value={confidence} aria-label="Filter by confidence">
				<option value="">All confidence</option>
				<option value="high">high</option>
				<option value="medium">medium</option>
			</select>
			<select bind:value={basis} aria-label="Filter by basis">
				<option value="">All bases</option>
				{#each bases as b (b)}
					<option value={b}>{b}</option>
				{/each}
			</select>
			<select bind:value={audit} aria-label="Filter by audit">
				<option value="">All audit</option>
				<option value="approved">approved</option>
				<option value="rejected">rejected</option>
				<option value="unclear">unclear</option>
				<option value="unreviewed">unreviewed</option>
			</select>
			<span class="filter-count">{filtered.length} of {matched.length}</span>
		</div>
		<div class="table-wrap">
			<table class="ref-table">
				<thead>
					<tr>
						<th>OTD Name</th>
						<th>Tablet Entity</th>
						<th>Tablet Full Name</th>
						<th>Confidence</th>
						<th>Basis</th>
						<th>Audit</th>
						<th>OTD Area (mm)</th>
						<th>Our Area (mm)</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as m (m.otdFile)}
						<tr>
							<td>{m.otdName}</td>
							<td><EntityLink entityId={m.entityId!}>{m.modelId}</EntityLink></td>
							<td>{m.fullName ?? '—'}</td>
							<td><span class="badge conf-{m.confidence}">{m.confidence}</span></td>
							<td class="dim mono">{m.basis}</td>
							<td><span class="badge audit-{m.audit}">{m.audit}</span></td>
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
	.meta code {
		background: var(--bg-card);
		padding: 1px 5px;
		border-radius: var(--radius);
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
	/* Confidence: high (name/id confirmed by size) carries the accent edge. */
	.badge.conf-high {
		border-color: var(--accent);
		color: var(--accent);
	}
	/* Audit verdict colours: status vocabulary, never the accent. */
	.badge.audit-approved {
		border-color: var(--good);
		color: var(--good);
	}
	.badge.audit-rejected {
		border-color: var(--danger);
		color: var(--danger);
	}
	.badge.audit-unclear {
		border-color: var(--warning);
		color: var(--warning);
	}
	.badge.audit-unreviewed {
		border-color: var(--border);
		color: var(--text-dim);
	}
</style>
