<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';

	let { tabs }: { tabs: { href: string; label: string }[] } = $props();
</script>

<div class="sub-nav">
	{#each tabs as t}
		<a href="{base}{t.href}" class:active={page.url.pathname === base + t.href}>{t.label}</a>
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
		padding: 5px 14px;
		font-size: 12px;
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
</style>
