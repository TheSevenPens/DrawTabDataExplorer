<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { nextTabIndex } from '$lib/tab-keys.js';

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

	// The tab the page opened on — what a URL with *no* hash means. Captured
	// before the hash effect below runs, so it is the parent's default.
	const defaultTab = untrack(() => active);

	// Hash → active. Picks up the hash on mount AND on every history
	// navigation (back/forward), because page.url is reactive. An empty hash
	// restores the default tab: Back from #specs to the hashless URL used to
	// leave Specs selected (#334). `active` is read untracked so a parent that
	// sets the tab itself isn't overridden by this effect.
	$effect(() => {
		if (!hashed) return;
		const hash = page.url.hash.slice(1);
		const target = hash ? (validIds.has(hash) ? hash : null) : defaultTab;
		if (target && target !== untrack(() => active)) active = target;
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

	// WAI-ARIA tabs with manual activation (#335): one tab stop for the whole
	// list (roving tabindex on the selected tab), arrows/Home/End move focus,
	// Enter/Space selects via the native button click. See tab-keys.ts.
	function onTabKeydown(e: KeyboardEvent) {
		const buttons = [
			...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]'),
		];
		const next = nextTabIndex(buttons.indexOf(e.target as HTMLElement), buttons.length, e.key);
		if (next === null) return;
		e.preventDefault();
		buttons[next].focus();
	}
</script>

<div class="detail-tabs" role="tablist" tabindex="-1" onkeydown={onTabKeydown}>
	{#each visibleTabs as tab (tab.id)}
		{@const hasBadge = tab.badge !== undefined && tab.badge !== ''}
		<button
			type="button"
			role="tab"
			aria-selected={active === tab.id}
			tabindex={active === tab.id ? 0 : -1}
			class:active={active === tab.id}
			onclick={() => select(tab.id)}
		>
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
	/* Metro focus: an accent edge, not a halo. */
	.detail-tabs button:focus-visible {
		outline: 1px solid var(--accent);
		outline-offset: 4px;
	}
</style>
