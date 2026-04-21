<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';

	/**
	 * Resolve an EntityId to its detail page path.
	 *
	 * Formats:
	 *   brand                            → /brands/brand
	 *   brand.tablet.modelid             → /tablets/brand.tablet.modelid
	 *   brand.pen.penid                  → /pens/brand.pen.penid
	 *   brand.driver.version_os          → /drivers/brand.driver.version_os
	 *   brand.penfamily.familyid         → /pen-families/brand.penfamily.familyid
	 *   brand.tabletfamily.familyid      → /tablet-families/brand.tabletfamily.familyid
	 */
	function resolveEntityPath(entityId: string): string | null {
		const parts = entityId.split('.');
		if (parts.length === 1) {
			// Brand — no dots
			return `${base}/brands/${encodeURIComponent(entityId)}`;
		}
		const type = parts[1];
		switch (type) {
			case 'tablet':      return `${base}/tablets/${encodeURIComponent(entityId)}`;
			case 'pen':         return `${base}/pens/${encodeURIComponent(entityId)}`;
			case 'driver':      return `${base}/drivers/${encodeURIComponent(entityId)}`;
			case 'penfamily':   return `${base}/pen-families/${encodeURIComponent(entityId)}`;
			case 'tabletfamily':return `${base}/tablet-families/${encodeURIComponent(entityId)}`;
			default:            return null;
		}
	}

	let entityId = $derived(page.params.entityId);
	let resolvedPath = $derived(resolveEntityPath(entityId));

	onMount(() => {
		if (resolvedPath) {
			goto(resolvedPath, { replaceState: true });
		}
	});
</script>

{#if resolvedPath}
	<p>Redirecting to <a href={resolvedPath}>{resolvedPath}</a>…</p>
{:else}
	<h1>Unknown entity</h1>
	<p>Could not resolve entity ID: <code>{entityId}</code></p>
{/if}
