<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	export interface Tab {
		id: string;
		label: string;
		/** Optional count chip rendered next to the label, e.g. "Inventory (12)". */
		badge?: number | string;
		/** Defaults to true. Set false to conditionally hide a tab. */
		visible?: boolean;
	}

	let {
		tabs,
		active = $bindable(),
		hashed = true,
	}: {
		tabs: Tab[];
		active: string;
		/** When true (default), the active tab id is mirrored to/from the URL
		 * hash so browser back/forward and bookmarking restore the tab.
		 * Mirrors the pattern used by `SectionedPage`. Set false on pages
		 * that already use the hash for something else. */
		hashed?: boolean;
	} = $props();

	let visibleTabs = $derived(tabs.filter((t) => t.visible !== false));
	let validIds = $derived(new Set(visibleTabs.map((t) => t.id)));

	// Hash → active. Picks up the hash on mount AND on every history
	// navigation (back/forward), because page.url is reactive.
	$effect(() => {
		if (!hashed) return;
		const hash = page.url.hash.slice(1);
		if (hash && validIds.has(hash) && hash !== active) active = hash;
	});

	function select(id: string) {
		if (!hashed) {
			active = id;
			return;
		}
		// active is updated by the $effect above once the hash changes.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${page.url.pathname}${page.url.search}#${id}`, {
			replaceState: false,
			noScroll: true,
			keepFocus: true,
		});
	}
</script>

<div class="detail-tabs">
	{#each visibleTabs as tab (tab.id)}
		{@const hasBadge = tab.badge !== undefined && tab.badge !== ''}
		<button class:active={active === tab.id} onclick={() => select(tab.id)}>
			{hasBadge ? `${tab.label} (${tab.badge})` : tab.label}
		</button>
	{/each}
</div>

<style>
	/*
	 * Metro word list, matching Nav / SubNav: no tab outlines, no fills —
	 * the active tab is simply the bright word. Lowercasing is done in CSS
	 * so the DOM keeps the authored label ("IAF", "JSON") for assistive
	 * tech and for search.
	 */
	.detail-tabs {
		display: flex;
		gap: 18px;
		margin-bottom: 20px;
		flex-wrap: wrap;
	}
	.detail-tabs button {
		padding: 0;
		font-size: var(--type-subhead);
		font-weight: 400;
		letter-spacing: var(--track-tight);
		text-transform: lowercase;
		border: none;
		background: transparent;
		color: var(--text-dim);
		cursor: pointer;
		transition: color 120ms ease-out;
	}
	.detail-tabs button:hover {
		color: var(--text-muted);
	}
	.detail-tabs button.active {
		color: var(--text);
	}
</style>
