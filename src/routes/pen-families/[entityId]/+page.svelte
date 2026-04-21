<script lang="ts">
	import { base } from '$app/paths';
	import { brandName } from '$data/lib/drawtab-loader.js';
	import type { Pen } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import { type PenFamily, PEN_FAMILY_FIELDS, PEN_FAMILY_FIELD_GROUPS } from '$data/lib/entities/pen-family-fields.js';
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
		<ul class="entity-list">
			{#each memberPens as p}
				<li>
					<a href="{base}/entity/{encodeURIComponent(p.EntityId)}">
						{brandName(p.Brand)} {p.PenName}
						{#if p.PenName !== p.PenId}<span class="dim">({p.PenId})</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="dim">No pens are linked to this family.</p>
	{/if}
</section>

<style>
	.members { margin-top: 24px; }
	.members h2 { font-size: 16px; margin-bottom: 8px; }
	.entity-list { list-style: none; padding: 0; }
	.entity-list li { padding: 4px 0; }
	.entity-list a { color: var(--link); text-decoration: none; }
	.entity-list a:hover { text-decoration: underline; }
</style>
