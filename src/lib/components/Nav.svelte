<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { unitPreference, toggleUnits, showAltUnits, toggleAltUnits } from '$lib/unit-store.js';
	import { theme, toggleTheme } from '$lib/theme-store.js';

	type LinkSpec = {
		href: string;
		label: string;
		// Additional pathnames (without base prefix) that should mark this link as active.
		altActive?: string[];
	};

	const links: LinkSpec[] = [
		{ href: '/brands', label: 'Brands' },
		{
			href: '/',
			label: 'Tablets',
			altActive: ['/tablet-families', '/tablet-analysis', '/compare-tablets'],
		},
		{ href: '/pens', label: 'Pens', altActive: ['/pen-families', '/pressure-response'] },
		{ href: '/drivers', label: 'Drivers' },
		{ href: '/inventory', label: 'Inventory' },
		{ href: '/timeline', label: 'Timeline' },
		{ href: '/reference', label: 'Data', altActive: ['/data-quality', '/pen-compat'] },
		{ href: '/about', label: 'About' },
	];

	function isActive(link: LinkSpec, path: string): boolean {
		const norm = path.startsWith(base) ? path.slice(base.length) || '/' : path;
		if (norm === link.href) return true;
		return (link.altActive ?? []).includes(norm);
	}

	let settingsOpen = $state(false);
</script>

<svelte:window onclick={() => (settingsOpen = false)} />

<nav>
	<div class="nav-links">
		{#each links as link}
			<a href="{base}{link.href}" class:active={isActive(link, page.url.pathname)}>{link.label}</a>
		{/each}
	</div>
	<div class="nav-toggles">
		<div class="settings-wrap" role="none" onclick={(e) => e.stopPropagation()}>
			<button
				class="settings-btn"
				onclick={() => (settingsOpen = !settingsOpen)}
				title="Settings"
				aria-label="Settings"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="3" />
					<path
						d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
					/>
				</svg>
			</button>
			{#if settingsOpen}
				<div class="settings-dropdown">
					<div class="settings-row">
						<span class="settings-label">Units</span>
						<button class="toggle-btn" onclick={toggleUnits}>
							{$unitPreference === 'metric' ? 'Metric' : 'Imperial'}
						</button>
					</div>
					<div class="settings-row">
						<span class="settings-label">Theme</span>
						<button class="toggle-btn" onclick={toggleTheme}>
							{$theme === 'light' ? 'Dark' : 'Light'}
						</button>
					</div>
					<div class="settings-row">
						<span class="settings-label">Alt Units</span>
						<button class="toggle-btn" onclick={toggleAltUnits}>
							{$showAltUnits ? 'On' : 'Off'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</nav>

<style>
	nav {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		border-bottom: 2px solid var(--border);
		margin-bottom: 16px;
		flex-wrap: wrap;
		gap: 0;
	}

	.nav-links {
		display: flex;
		gap: 0;
		flex-wrap: wrap;
		align-items: flex-end;
	}

	a {
		padding: 6px 12px;
		font-size: 13px;
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: 4px 4px 0 0;
		color: var(--text-muted);
		text-decoration: none;
		background: transparent;
		position: relative;
		bottom: -2px;
	}

	a:hover {
		color: #2563eb;
		background: var(--bg-card);
		border-color: var(--border);
	}

	a.active {
		background: var(--bg);
		color: #2563eb;
		border-color: var(--border);
		font-weight: 600;
	}

	.nav-toggles {
		display: flex;
		gap: 4px;
		align-items: center;
		padding-bottom: 6px;
	}

	.settings-wrap {
		position: relative;
	}

	.settings-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text-muted);
		cursor: pointer;
		padding: 0;
	}

	.settings-btn:hover {
		border-color: #2563eb;
		color: #2563eb;
	}

	.settings-dropdown {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
		padding: 8px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 160px;
		z-index: 100;
	}

	.settings-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.settings-label {
		font-size: 12px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.toggle-btn {
		padding: 3px 10px;
		font-size: 12px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text);
		cursor: pointer;
		font-weight: 600;
		white-space: nowrap;
	}

	.toggle-btn:hover {
		border-color: #2563eb;
		color: #2563eb;
	}
</style>
