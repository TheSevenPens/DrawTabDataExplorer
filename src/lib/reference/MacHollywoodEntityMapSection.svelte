<script lang="ts">
	// Our reading of the MacHollywood page: every model/pen code it prints,
	// matched against our entities. From
	// data/machollywood/machollywood-pen-compat-annotations.json, which is kept
	// apart from the capture on purpose — the capture says what the page says,
	// this says what we make of it. Refresh with `npm run annotate-machollywood`.
	//
	// Only EXACT is settled. PREFIX/PARTIAL carry an entityId but are proposals:
	// the page's Colorelli FT-0405U10 prefix-matches our Volito FT-0405-U, which
	// is wrong, and is pinned to NONE by hand. A pinned row shows as "manual".
	import EntityLink from '$lib/components/EntityLink.svelte';
	import type {
		MacHollywoodAnnotations,
		MacHollywoodCodeMapping,
		MacHollywoodMatchKind,
	} from '$data/lib/drawtab-loader.js';

	let { annotations }: { annotations: MacHollywoodAnnotations | null } = $props();

	interface Row extends MacHollywoodCodeMapping {
		recordId: string;
		heading: string;
		kind: 'tablet' | 'pen';
	}

	const rows = $derived<Row[]>(
		(annotations?.records ?? []).flatMap((r) => [
			...r.tablets.map((m) => ({
				...m,
				recordId: r.id,
				heading: r.heading,
				kind: 'tablet' as const,
			})),
			...r.pens.map((m) => ({ ...m, recordId: r.id, heading: r.heading, kind: 'pen' as const })),
		]),
	);

	const MATCH_KINDS: MacHollywoodMatchKind[] = ['EXACT', 'PREFIX', 'PARTIAL', 'AMBIGUOUS', 'NONE'];

	// --- Filters (client-side) ---
	let search = $state('');
	let kind = $state('');
	let match = $state('');
	const filtered = $derived(
		rows.filter(
			(m) =>
				(kind === '' || m.kind === kind) &&
				(match === '' || m.match === match) &&
				(search === '' ||
					`${m.token} ${m.heading} ${m.entityId ?? ''}`
						.toLowerCase()
						.includes(search.toLowerCase())),
		),
	);

	const distinct = (k: MacHollywoodMatchKind) =>
		new Set(rows.filter((m) => m.match === k).map((m) => m.token)).size;
	const counts = $derived({
		refs: rows.length,
		codes: new Set(rows.map((m) => m.token)).size,
		resolved: rows.filter((m) => m.entityId).length,
		manual: rows.filter((m) => m.manual).length,
	});
	const src = $derived(annotations?.source ?? null);
</script>

<section>
	<div class="section-header">
		<h2>MacHollywood To Entity</h2>
	</div>
	<p class="meta">
		Every model and pen code the page prints, matched against our data. <strong
			>Only EXACT is settled</strong
		>: PREFIX means the page code is one of our Ids plus a suffix (usually a colour or variant),
		PARTIAL means ours is the more specific of the two, and both are proposals to review rather than
		facts. AMBIGUOUS rows have more than one equally good candidate and are left unresolved on
		purpose.
	</p>
	{#if src}
		<p class="meta">
			{counts.refs} references · {counts.codes} distinct codes · {counts.resolved} resolved · {counts.manual}
			pinned by hand · generated {src.generatedAt} · refresh with
			<code>npm run annotate-machollywood</code>
		</p>
		<p class="meta">
			By match:
			{#each MATCH_KINDS as k, i (k)}{i > 0 ? ' · ' : ''}{k}
				{distinct(k)}{/each}
			(distinct codes)
		</p>
	{/if}

	{#if rows.length}
		<div class="ref-filters">
			<input type="search" placeholder="Search code, model or entity…" bind:value={search} />
			<select bind:value={kind} aria-label="Filter by entity kind">
				<option value="">Tablets and pens</option>
				<option value="tablet">Tablets</option>
				<option value="pen">Pens</option>
			</select>
			<select bind:value={match} aria-label="Filter by match kind">
				<option value="">All matches</option>
				{#each MATCH_KINDS as k (k)}
					<option value={k}>{k}</option>
				{/each}
			</select>
			<span class="filter-count">{filtered.length} of {rows.length}</span>
		</div>
		<div class="table-wrap">
			<table class="ref-table">
				<thead>
					<tr>
						<th>Page Code</th>
						<th>Kind</th>
						<th>Match</th>
						<th>Entity</th>
						<th>Our Id</th>
						<th>Model on Page</th>
						<th>Context</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as m, i (`${m.recordId}|${m.kind}|${m.token}|${i}`)}
						<tr>
							<td class="mono">{m.token}</td>
							<td class="dim">{m.kind}</td>
							<td>
								<span class="badge match-{m.match.toLowerCase()}">{m.match}</span>
								{#if m.manual}<span class="badge manual">manual</span>{/if}
							</td>
							<td>
								{#if m.entityId}
									<EntityLink entityId={m.entityId}>{m.entityId}</EntityLink>
								{:else if m.candidates?.length}
									<span class="dim">{m.candidates.join(', ')}</span>
								{:else}
									<span class="dim">—</span>
								{/if}
							</td>
							<td class="mono">{m.ourId ?? '—'}</td>
							<td>{m.heading}</td>
							<td class="dim context">
								{m.context}
								{#if m.note}<div class="note">{m.note}</div>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="meta">No MacHollywood annotations available.</p>
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
		max-width: 900px;
		line-height: 1.5;
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
	.dim {
		color: var(--text-muted);
	}
	.context {
		max-width: 44ch;
		font-size: var(--type-caption);
	}
	.note {
		margin-top: 3px;
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
	/* Match quality is a status vocabulary: settled / needs review / unresolved.
	   The accent marks the one kind we trust, never a problem state. */
	.badge.match-exact {
		border-color: var(--good);
		color: var(--good);
	}
	.badge.match-prefix,
	.badge.match-partial {
		border-color: var(--warning);
		color: var(--warning);
	}
	.badge.match-ambiguous {
		border-color: var(--border);
		color: var(--text-dim);
	}
	.badge.match-none {
		border-color: var(--danger);
		color: var(--danger);
	}
	.badge.manual {
		margin-left: 4px;
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
