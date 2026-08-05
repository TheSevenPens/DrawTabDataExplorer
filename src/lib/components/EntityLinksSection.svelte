<script lang="ts">
	// External reference links for a tablet/pen entity, as one flat list (each
	// row tagged with its type). Data lives on Model.Links / Links; curated via
	// the /links-review page.
	import type { Link } from '$data/lib/drawtab-loader.js';

	let { links }: { links: Link[] } = $props();

	const RANK: Record<string, number> = {
		MANUFACTURERPRODUCTINFO: 0,
		PRODUCTINFO: 1,
		MANUFACTURERUSERMANUAL: 2,
		USERMANUAL: 3,
		REVIEW: 4,
		STORE: 5,
	};
	const TYPE_LABEL: Record<string, string> = {
		MANUFACTURERPRODUCTINFO: 'official product',
		PRODUCTINFO: 'product',
		MANUFACTURERUSERMANUAL: 'official manual',
		USERMANUAL: 'manual',
		REVIEW: 'review',
		STORE: 'store',
	};

	// One list, ordered by type then original order (stable sort).
	const ordered = $derived([...links].sort((a, b) => (RANK[a.Type] ?? 9) - (RANK[b.Type] ?? 9)));

	function hostOf(url: string): string {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}
</script>

{#if ordered.length}
	<ul class="links">
		{#each ordered as l (l.URL)}
			<li>
				<span class="tag tag-{l.Type}">{TYPE_LABEL[l.Type] ?? l.Type}</span>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a href={l.URL} target="_blank" rel="noopener">{l.Title || hostOf(l.URL)}</a>
				{#if l.Author}<span class="dim"> · {l.Author}</span>{/if}
				{#if l.PublishDate}<span class="dim"> · {l.PublishDate}</span>{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="dim">No links.</p>
{/if}

<style>
	.links {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 900px;
	}
	li {
		font-size: 13px;
		line-height: 1.4;
	}
	.tag {
		display: inline-block;
		min-width: 58px;
		margin-right: 8px;
		padding: 0 6px;
		font-size: var(--type-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		text-align: center;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text-dim);
		vertical-align: 1px;
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
