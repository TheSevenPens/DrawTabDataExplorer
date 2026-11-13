<script lang="ts">
	// Seven Pens' rating, notes and lists for a tablet or pen, and every price
	// seen for it. Ratings and prices are dated records that are never edited
	// (DrawTabData docs/RECOMMENDATIONS.md, docs/PRICES.md), so this shows the
	// current values and the full history.
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { formatPrice, type RecommendationView } from '$lib/recommendation-view';

	let { view }: { view: RecommendationView } = $props();
	const KIND = {
		CURRENT: 'store price',
		LAUNCH: 'launch price',
		RETAIL: 'early store price',
		LIST: 'list price',
	};
</script>

{#if view.isEmpty}
	<EmptyState>No rating, notes or prices recorded for this model.</EmptyState>
{:else}
	<dl class="summary">
		<div>
			<dt>Seven Pens rating</dt>
			<dd>{view.rating ? view.rating.rating : 'not rated'}</dd>
			{#if view.rating}<dd class="sub">
					since {view.rating.since}{view.rating.basis === 'SPECS_ONLY' ? ', on specs only' : ''}
				</dd>{/if}
		</div>
		<div>
			<dt>Price now (U.S.)</dt>
			<dd>
				{view.current ? formatPrice(view.current.Amount, view.current.Currency) : 'not checked'}
			</dd>
			{#if view.current}<dd class="sub">
					{view.current.Date}{view.current.Seller ? `, ${view.current.Seller}` : ''}
				</dd>{/if}
		</div>
		<div>
			<dt>Launch price (U.S.)</dt>
			<dd>{view.launch ? formatPrice(view.launch.Amount, view.launch.Currency) : 'unknown'}</dd>
			{#if view.launch}<dd class="sub">
					{view.launch.Date ?? 'date unknown'}{view.launch.Kind === 'RETAIL'
						? ', early store price'
						: ''}
				</dd>{/if}
		</div>
		{#if view.lists.length}
			<div>
				<dt>Lists</dt>
				<dd>{view.lists.join(', ').toLowerCase()}</dd>
			</div>
		{/if}
	</dl>

	{#if view.notes.length}
		<h3>Notes</h3>
		<ul class="notes">
			{#each view.notes as n (n._id)}
				<li><span class="kind">{n.Kind}</span> {n.Text} <span class="date">{n.Date}</span></li>
			{/each}
		</ul>
	{/if}

	{#if view.ratings.length}
		<h3>Rating history</h3>
		<table>
			<thead><tr><th>Date</th><th>Rating</th><th>Context</th><th>Source</th></tr></thead>
			<tbody>
				{#each view.ratings as r (r._id)}
					<tr>
						<td>{r.Date}</td>
						<td>{r.Rating}{r.OriginalRating ? ` (was ${r.OriginalRating})` : ''}</td>
						<td>{r.Context ?? ''}</td>
						<td>{r.Source}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	{#if view.prices.length}
		<h3>Prices seen</h3>
		<table>
			<thead><tr><th>Date</th><th>Kind</th><th>Price</th><th>Seller</th><th>Checked</th></tr></thead
			>
			<tbody>
				{#each view.prices as p (p._id)}
					<tr>
						<td>{p.Date ?? ''}</td>
						<td>{KIND[p.Kind]}</td>
						<td>{formatPrice(p.Amount, p.Currency)}</td>
						<td
							>{#if p.URL}<a href={p.URL} rel="noopener noreferrer" target="_blank"
									>{p.Seller ?? 'source'}</a
								>{:else}{p.Seller ?? ''}{/if}</td
						>
						<td>{p.CheckedOn}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="disclaimer">
			Prices are as a store listed them on the date shown. They don't include sales, promotions or
			discounts, and prices differ by country.
		</p>
	{/if}
{/if}

<style>
	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 0 32px;
		margin: 0 0 16px;
	}
	.summary dt {
		font-size: var(--type-micro);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		color: var(--text-dim);
	}
	.summary dd {
		margin: 2px 0 0;
		font-size: var(--type-subhead);
		font-weight: var(--weight-display);
		color: var(--text);
	}
	.summary dd.sub {
		font-size: var(--type-caption);
		color: var(--text-muted);
	}
	h3 {
		margin: 20px 0 8px;
		font-size: var(--type-heading);
		font-weight: var(--weight-display);
	}
	.notes {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.notes li {
		padding: 4px 0;
	}
	.kind {
		font-size: var(--type-micro);
		font-weight: 600;
		letter-spacing: var(--track-wide);
		color: var(--text-dim);
	}
	.date,
	.disclaimer {
		font-size: var(--type-caption);
		color: var(--text-muted);
	}
</style>
