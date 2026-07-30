<script lang="ts">
	// External reference links for a tablet/pen entity, grouped by type.
	// Data lives on Model.Links / Links; curated via the /links-review page.
	import type { Link } from '$data/lib/drawtab-loader.js';

	let { links }: { links: Link[] } = $props();

	const ORDER = [
		['REVIEW', 'Reviews'],
		['PRODUCTINFO', 'Product info'],
		['USERMANUAL', 'User manuals'],
		['STORE', 'Store'],
	] as const;

	const groups = $derived(
		ORDER.map(([type, label]) => ({
			label,
			items: links.filter((l) => l.Type === type),
		})).filter((g) => g.items.length),
	);

	function hostOf(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}
</script>

{#if groups.length}
	<div class="links">
		{#each groups as g (g.label)}
			<section class="group">
				<h3>{g.label} <span class="cnt">{g.items.length}</span></h3>
				<ul>
					{#each g.items as l (l.URL)}
						<li>
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={l.URL} target="_blank" rel="noopener">{l.Title || hostOf(l.URL)}</a>
							{#if l.Author}<span class="dim"> · {l.Author}</span>{/if}
							{#if l.PublishDate}<span class="dim"> · {l.PublishDate}</span>{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{:else}
	<p class="dim">No links.</p>
{/if}

<style>
	.links {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 16px 28px;
	}
	.group {
		min-width: 0;
	}
	h3 {
		font-size: var(--type-micro);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		color: var(--text-muted);
		margin-bottom: 6px;
		padding-bottom: 3px;
		border-bottom: 1px solid var(--border);
	}
	.cnt {
		color: var(--text-dim);
		margin-left: 4px;
	}
	ul {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	li {
		font-size: 13px;
		line-height: 1.35;
	}
	a {
		color: var(--link);
		text-decoration: none;
		word-break: break-word;
	}
	a:hover {
		text-decoration: underline;
	}
	.dim {
		color: var(--text-dim);
		font-size: var(--type-caption);
	}
</style>
