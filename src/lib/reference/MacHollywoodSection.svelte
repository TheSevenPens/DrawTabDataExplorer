<script lang="ts">
	// The MacHollywood pen-compatibility capture, as the page presents it: one
	// row per model, with the pens that page lists for it. Straight from
	// data/machollywood/machollywood-pen-compat.json — a mirror of somebody
	// else's article, so nothing here is normalised or corrected. Our reading of
	// it (EntityId mapping) is the sibling "MacHollywood To Entity" section.
	// Refresh with `npm run capture-machollywood` from data-repo.
	import type { MacHollywoodDataset } from '$data/lib/drawtab-loader.js';

	let { dataset }: { dataset: MacHollywoodDataset | null } = $props();

	const src = $derived(dataset?.source ?? null);
	const records = $derived(dataset?.segments.flatMap((s) => (s.record ? [s.record] : [])) ?? []);

	// --- Filters (client-side) ---
	let search = $state('');
	let section = $state('');
	const sections = $derived([...new Set(records.map((r) => r.section ?? ''))].filter(Boolean));
	const filtered = $derived(
		records.filter(
			(r) =>
				(section === '' || r.section === section) &&
				(search === '' ||
					`${r.heading} ${r.skuLine ?? ''} ${r.compatibility.join(' ')}`
						.toLowerCase()
						.includes(search.toLowerCase())),
		),
	);

	// The page prints "SKU: X" / "SKUs: X, Y"; drop the label for the column.
	const skus = (line: string | null) => line?.replace(/^SKUs?:\s*/i, '') ?? '—';
	const shortSha = $derived(src?.textSha256.slice(0, 12) ?? '');

	// Built as one string rather than inline {#if}s: Svelte trims the whitespace
	// around a block, so the interpolated pieces would run together.
	const byline = $derived(
		[src?.posted ? `posted ${src.posted}` : null, src?.author ? `by ${src.author}` : null]
			.filter(Boolean)
			.join(' '),
	);
</script>

<section>
	<div class="section-header">
		<h2>MacHollywood Pen Compat</h2>
	</div>
	<p class="meta">
		Wacom tablets and Cintiqs with the pens that fit them, from
		{#if src}
			<!-- External source URL from the capture's provenance, not an app route. -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={src.url} target="_blank" rel="noopener">{src.site}</a>
		{:else}
			machollywood.com
		{/if}
		— a replacement-pen lookup, not a spec sheet. Captured verbatim, so the wording, the generation labels
		and the SKU conventions are all theirs.
	</p>
	{#if src}
		<p class="meta">
			{records.length} models · {byline}{src.pageUpdated ? `, page updated ${src.pageUpdated}` : ''}
			· captured {src.retrievedAt} · text
			<code>{shortSha}</code>
			· refresh with <code>npm run capture-machollywood</code>
		</p>
	{/if}

	{#if records.length}
		<div class="ref-filters">
			<input type="search" placeholder="Search model, SKU or pen…" bind:value={search} />
			<select bind:value={section} aria-label="Filter by section">
				<option value="">All sections</option>
				{#each sections as s (s)}
					<option value={s}>{s}</option>
				{/each}
			</select>
			<span class="filter-count">{filtered.length} of {records.length}</span>
		</div>
		<div class="table-wrap">
			<table class="ref-table">
				<thead>
					<tr>
						<th>Model</th>
						<th>Section</th>
						<th>Included Pen</th>
						<th>SKUs</th>
						<th>Pen Compatibility</th>
					</tr>
				</thead>
				<tbody>
					{#each filtered as r (r.id)}
						<tr>
							<td>
								{r.heading}
								{#if r.description.length || r.bullets.length}
									<div class="page-note">
										{#each r.description as line (line)}<div>{line}</div>{/each}
										{#each r.bullets as line (line)}<div>· {line}</div>{/each}
									</div>
								{/if}
							</td>
							<td class="dim">
								{r.section ?? '—'}
								{#if r.group}<div class="dim">{r.group}</div>{/if}
							</td>
							<td>{r.includedPen ?? '—'}</td>
							<td class="mono">{skus(r.skuLine)}</td>
							<td>
								{#each r.compatibility as line (line)}<div>{line}</div>{/each}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p class="meta">No MacHollywood reference data available.</p>
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
	/* The page's own prose, kept subordinate to the model it describes. */
	.page-note {
		margin-top: 3px;
		max-width: 46ch;
		color: var(--text-dim);
		font-size: var(--type-caption);
		line-height: 1.45;
	}
</style>
