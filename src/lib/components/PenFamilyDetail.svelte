<script lang="ts">
	import { base } from '$app/paths';
	import { brandName } from '$data/lib/drawtab-loader.js';
	import type { Pen } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import {
		type PenFamily,
		PEN_FAMILY_FIELDS,
		PEN_FAMILY_FIELD_GROUPS,
	} from '$data/lib/entities/pen-family-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let { data } = $props();
	let family: PenFamily = $derived(data.family);
	let memberPens: Pen[] = $derived(data.memberPens);
</script>

<Nav />

<h1>{family.FamilyName}</h1>
<DetailView item={family} fields={PEN_FAMILY_FIELDS} fieldGroups={PEN_FAMILY_FIELD_GROUPS} />

<section class="members">
	<h2>Pens in this family ({memberPens.length})</h2>
	{#if memberPens.length > 0}
		<table class="pen-table">
			<thead>
				<tr><th>Name</th><th>Year</th></tr>
			</thead>
			<tbody>
				{#each memberPens as p}
					<tr>
						<td>
							<a href="{base}/entity/{encodeURIComponent(p.EntityId)}">
								{brandName(p.Brand)}
								{p.PenName}
								{#if p.PenName !== p.PenId}<span class="dim">({p.PenId})</span>{/if}
							</a>
						</td>
						<td class="year">{p.PenYear || ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{:else}
		<p class="dim">No pens are linked to this family.</p>
	{/if}
</section>

<style>
	.members {
		margin-top: 24px;
	}
	.members h2 {
		font-size: 16px;
		margin-bottom: 8px;
	}
	.pen-table {
		border-collapse: collapse;
		font-size: 13px;
		width: 100%;
	}
	.pen-table th {
		text-align: left;
		padding: 5px 10px;
		background: var(--th-bg);
		color: var(--th-text);
		border-bottom: 1px solid var(--border);
	}
	.pen-table td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}
	.pen-table tr:hover td {
		background: var(--hover-bg);
	}
	.pen-table a {
		color: var(--link);
		text-decoration: none;
	}
	.pen-table a:hover {
		text-decoration: underline;
	}
	.year {
		color: var(--text-muted);
		width: 60px;
	}
</style>
