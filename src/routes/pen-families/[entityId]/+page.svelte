<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { loadPenFamiliesFromURL } from '$data/lib/drawtab-loader.js';
	import { type PenFamily, PEN_FAMILY_FIELDS, PEN_FAMILY_FIELD_GROUPS } from '$data/lib/entities/pen-family-fields.js';
	import DetailView from '$lib/components/DetailView.svelte';

	let item: PenFamily | null = $state(null);
	let notFound = $state(false);

	onMount(async () => {
		const entityId = decodeURIComponent(page.params.entityId!);
		const all = (await loadPenFamiliesFromURL(base)) as PenFamily[];
		const found = all.find((f) => f.EntityId === entityId);
		if (found) { item = found; } else { notFound = true; }
	});
</script>

{#if notFound}
	<h1>Pen family not found</h1>
	<p><a href="{base}/pen-families">Back to pen families</a></p>
{:else}
	<h1>{item?.FamilyName ?? 'Loading...'}</h1>
	<DetailView item={item} fields={PEN_FAMILY_FIELDS} fieldGroups={PEN_FAMILY_FIELD_GROUPS} backHref="/pen-families" backLabel="Pen Families" />
{/if}
