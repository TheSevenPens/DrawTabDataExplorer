<script lang="ts">
	// Canonical link to an entity's detail page (GitHub #238). Centralizes the
	// `resolve('/entity/[entityId]', ...)` call and the shared link styling that
	// ~20 files were repeating inline. The *label* stays a snippet — callers pass
	// it from the canonical formatters (penFullName/tabletFullName/…); this
	// component never reconstructs a display name (see CLAUDE.md "Label
	// formatting"). For data-shaped links (e.g. ResultsTable cellLinks) use the
	// route's own href building; this is for markup `<a>` usages.
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	let {
		entityId,
		title,
		children,
	}: {
		entityId: string;
		title?: string;
		children: Snippet;
	} = $props();

	let href = $derived(resolve('/entity/[entityId]', { entityId }));
</script>

<a {href} {title} class="entity-link">{@render children()}</a>

<style>
	.entity-link {
		color: var(--link);
		text-decoration: none;
	}
	.entity-link:hover {
		text-decoration: underline;
	}
</style>
