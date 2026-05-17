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
	.sub-nav {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--border);
		margin-bottom: 14px;
	}
	a {
		padding: 7px 16px;
		font-size: 16px;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		color: var(--text-muted);
		text-decoration: none;
		background: transparent;
		position: relative;
		bottom: -1px;
	}
	a:hover {
		color: #2563eb;
		background: var(--bg-card);
	}
	a.active {
		background: var(--bg);
		color: #2563eb;
		border-color: var(--border);
		font-weight: 600;
	}
	.badge {
		display: inline-block;
		margin-left: 6px;
		padding: 0 7px;
		font-size: 12px;
		font-weight: 700;
		line-height: 18px;
		background: #d97706;
		color: #fff;
		border-radius: 9px;
		vertical-align: middle;
	}
</style>
