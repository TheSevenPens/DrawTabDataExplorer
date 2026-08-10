<script lang="ts">
	// External reference links for a tablet/pen entity, as a table with
	// Type / Content / Status / Domain / Author / Title columns. Data lives on
	// Model.Links / Links; curated via the /links-review page.
	import type { Link } from '$data/lib/drawtab-loader.js';
	import ExportTableButton from '$lib/components/ExportTableButton.svelte';

	// `name` (e.g. the tablet/pen Model.Id) only labels the export file/title.
	let { links, name = '' }: { links: Link[]; name?: string } = $props();

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

	const exportHeaders = [
		'Type',
		'Content',
		'Status',
		'Domain',
		'Author',
		'Title',
		'URL',
		'Published',
	];
	const exportRows = $derived(
		ordered.map((l) => [
			TYPE_LABEL[l.Type] ?? l.Type,
			l.ContentType ?? '',
			l.Check?.Status ?? '',
			hostOf(l.URL),
			l.Author ?? '',
			l.Title ?? '',
			l.URL,
			l.PublishDate ?? '',
		]),
	);
</script>

{#if ordered.length}
	<div class="controls">
		<ExportTableButton
			entityType="links"
			title={name ? `${name} links` : 'Links'}
			filename={name ? `${name}-links` : 'links'}
			headers={exportHeaders}
			rows={exportRows}
		/>
	</div>
	<div class="table-wrap">
		<table class="links-table">
			<thead>
				<tr>
					<th>Type</th>
					<th>Content</th>
					<th>Status</th>
					<th>Domain</th>
					<th>Author</th>
					<th>Title</th>
				</tr>
			</thead>
			<tbody>
				{#each ordered as l (l.URL)}
					<tr>
						<td><span class="tag">{TYPE_LABEL[l.Type] ?? l.Type}</span></td>
						<td class="dim">{l.ContentType || '—'}</td>
						<td>
							{#if l.Check?.Status}<span class="tag status-{l.Check.Status}">{l.Check.Status}</span
								>{:else}<span class="dim">—</span>{/if}
						</td>
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
	.controls {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 8px;
	}
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
	/* Check-status colours: status vocabulary, never the accent. */
	.status-OK {
		border-color: var(--good);
		color: var(--good);
	}
	.status-DEAD {
		border-color: var(--danger);
		color: var(--danger);
	}
	.status-BLOCKED,
	.status-REDIRECT,
	.status-ERROR {
		border-color: var(--warning);
		color: var(--warning);
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
