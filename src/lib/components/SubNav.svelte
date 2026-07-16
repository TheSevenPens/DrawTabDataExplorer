<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';

	let { tabs }: { tabs: { href: string; label: string; badge?: number }[] } = $props();
</script>

<div class="sub-nav">
	{#each tabs as t (t.href)}
		{@const tabHref = `${base}${t.href}` as ResolvedPathname}
		<a href={tabHref} class:active={page.url.pathname === base + t.href}
			>{t.label}{#if t.badge !== undefined && t.badge > 0}<span class="badge">{t.badge}</span
				>{/if}</a
		>
	{/each}
</div>

<style>
	/* The Nav word list one step down the scale: same brightness-not-chrome
	   rule for active state, with the accent reserved for the badge. */
	.sub-nav {
		display: flex;
		gap: 20px;
		margin-bottom: 22px;
		flex-wrap: wrap;
	}
	a {
		padding: 0;
		font-size: var(--type-subhead);
		font-weight: 400;
		letter-spacing: var(--track-tight);
		text-transform: lowercase;
		color: var(--text-dim);
		text-decoration: none;
		background: transparent;
		transition: color 120ms ease-out;
	}
	a:hover {
		color: var(--text-muted);
	}
	/* Idle 400 → active 500, same brightness + weight pairing as Nav. */
	a.active {
		color: var(--text);
		font-weight: 500;
	}
	.badge {
		display: inline-block;
		margin-left: 6px;
		padding: 0 6px;
		font-size: var(--type-micro);
		font-weight: 700;
		line-height: 16px;
		background: var(--accent);
		color: var(--accent-contrast);
		border-radius: var(--radius);
		vertical-align: middle;
	}
</style>
