<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { unitPreference, toggleUnits } from '$lib/unit-store.js';
	import { theme, toggleTheme } from '$lib/theme-store.js';

	const links = [
		{ href: '/', label: 'Tablets' },
		{ href: '/pens', label: 'Pens' },
		{ href: '/pen-families', label: 'Pen Families' },
		{ href: '/tablet-families', label: 'Tablet Families' },
		{ href: '/pen-compat', label: 'Pen Compat' },
		{ href: '/drivers', label: 'Drivers' },
		{ href: '/pressure-response', label: 'Pressure Response' },
		{ href: '/inventory', label: 'Inventory' },
		{ href: '/timeline', label: 'Timeline' },
		{ href: '/data-quality', label: 'Data Quality' },
	];
</script>

<nav>
	<div class="nav-links">
		{#each links as link}
			<a href="{base}{link.href}" class:active={page.url.pathname === base + link.href}>{link.label}</a>
		{/each}
	</div>
	<div class="nav-toggles">
		<button class="unit-toggle" onclick={toggleUnits}>
			{$unitPreference === 'metric' ? 'Metric' : 'Imperial'}
		</button>
		<button class="theme-toggle" onclick={toggleTheme}>
			{$theme === 'light' ? 'Dark' : 'Light'}
		</button>
	</div>
</nav>

<style>
	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		flex-wrap: wrap;
		gap: 8px;
	}

	.nav-links {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	a {
		padding: 5px 12px;
		font-size: 13px;
		border: 1px solid var(--border-light);
		border-radius: 4px;
		color: var(--text-muted);
		text-decoration: none;
		background: var(--bg-card);
	}

	a:hover {
		border-color: #2563eb;
		color: #2563eb;
	}

	a.active {
		background: #2563eb;
		color: #fff;
		border-color: #2563eb;
	}

	.unit-toggle {
		padding: 5px 12px;
		font-size: 13px;
		border: 1px solid #16a34a;
		border-radius: 4px;
		background: var(--bg-card);
		color: #16a34a;
		cursor: pointer;
		font-weight: 600;
	}

	.unit-toggle:hover {
		background: #16a34a;
		color: #fff;
	}

	.nav-toggles {
		display: flex;
		gap: 4px;
	}

	.theme-toggle {
		padding: 5px 12px;
		font-size: 13px;
		border: 1px solid #6b7280;
		border-radius: 4px;
		background: var(--bg-card);
		color: #6b7280;
		cursor: pointer;
		font-weight: 600;
	}

	.theme-toggle:hover {
		background: #6b7280;
		color: #fff;
	}
</style>
