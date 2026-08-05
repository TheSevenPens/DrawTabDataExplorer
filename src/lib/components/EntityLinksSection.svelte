<script lang="ts">
	// External reference links for a tablet/pen entity, as a table with
	// Type / Domain / Author / Title columns. Data lives on Model.Links / Links;
	// curated via the /links-review page.
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

	// Ordered by type rank, then original order (stable sort).
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
	<div class="table-wrap">
		<table class="links-table">
			<thead>
				<tr>
					<th>Type</th>
					<th>Domain</th>
					<th>Author</th>
					<th>Title</th>
				</tr>
			</thead>
			<tbody>
				{#each ordered as l (l.URL)}
					<tr>
						<td><span class="tag">{TYPE_LABEL[l.Type] ?? l.Type}</span></td>
						<td class="dim">{hostOf(l.URL)}</td>
						<td class="dim">{l.Author || '—'}</td>
						<td class="title-cell">
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
							<a href={l.URL} target="_blank" rel="noopener">{l.Title || hostOf(l.URL)}</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="dim">No links.</p>
{/if}

<style>
	.links-table {
		width: auto;
		font-size: 13px;
	}
	.tag {
		display: inline-block;
		min-width: 58px;
		padding: 0 6px;
		font-size: var(--type-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		text-align: center;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text-dim);
	}
	.dim {
		color: var(--text-dim);
	}
	.title-cell {
		white-space: normal;
		max-width: 520px;
	}
	.title-cell a {
		color: var(--link);
		text-decoration: none;
		word-break: break-word;
	}
	.title-cell a:hover {
		text-decoration: underline;
	}
</style>
