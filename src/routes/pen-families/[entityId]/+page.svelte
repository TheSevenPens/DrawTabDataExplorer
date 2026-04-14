<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadPenFamiliesFromURL, loadPensFromURL, brandName } from '$data/lib/drawtab-loader.js';
	import Nav from '$lib/components/Nav.svelte';
	import type { Pen } from '$data/lib/drawtab-loader.js';
	import { type PenFamily, PEN_FAMILY_FIELDS, PEN_FAMILY_FIELD_GROUPS } from '$data/lib/entities/pen-family-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let item = $state<PenFamily | null>(null);
	let memberPens: Pen[] = $state([]);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId!);
		const [families, pens] = await Promise.all([
			loadPenFamiliesFromURL(base),
			loadPensFromURL(base),
		]);
		const found = (families as PenFamily[]).find((f) => f.EntityId === entityId);
		if (found) {
			item = found;
			memberPens = (pens as Pen[])
				.filter((p) => p.PenFamily === found.FamilyId)
				.sort((a, b) => a.PenId.localeCompare(b.PenId));
		} else {
			notFound = true;
		}
	});
</script>

<Nav />

{#if notFound}
	<h1>Pen family not found</h1>
	<p><a href="{base}/pen-families">Back to pen families</a></p>
{:else}
	<h1>{item?.FamilyName ?? 'Loading...'}</h1>
	<DetailView item={item} fields={PEN_FAMILY_FIELDS} fieldGroups={PEN_FAMILY_FIELD_GROUPS} backHref="/pen-families" backLabel="Pen Families" />

	{#if item}
		<section class="members">
			<h2>Pens in this family ({memberPens.length})</h2>
			{#if memberPens.length > 0}
				<ul class="entity-list">
					{#each memberPens as p}
						<li>
							<a href="{base}/pens/{encodeURIComponent(p.EntityId)}">
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
	{/if}
{/if}

<style>
	.members {
		margin-top: 24px;
	}
	.members h2 {
		font-size: 16px;
		margin-bottom: 8px;
	}
	.entity-list {
		list-style: none;
		padding: 0;
	}
	.entity-list li {
		padding: 4px 0;
	}
	.entity-list a {
		color: var(--link);
		text-decoration: none;
	}
	.entity-list a:hover {
		text-decoration: underline;
	}
</style>
