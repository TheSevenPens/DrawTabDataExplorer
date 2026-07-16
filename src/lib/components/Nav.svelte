<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { unitPreference, toggleUnits, showAltUnits, toggleAltUnits } from '$lib/unit-store.js';
	import { theme, toggleTheme } from '$lib/theme-store.js';

	type LinkSpec = {
		href: string;
		label: string;
		// Additional pathnames (without base prefix) that should mark this link as active.
		altActive?: string[];
	};

	const links: LinkSpec[] = [
		{
			href: '/tablets',
			label: 'Tablets',
			altActive: ['/tablet-families', '/tablet-analysis', '/tablet-inventory', '/tablet-compare'],
		},
		{
			href: '/pens',
			label: 'Pens',
			altActive: [
				'/pen-families',
				'/pen-analysis',
				'/pen-inventory',
				'/pen-flagged',
				'/pen-compare',
			],
		},
		{ href: '/drivers', label: 'Drivers' },
		{
			href: '/reference',
			label: 'Data',
			altActive: [
				'/data-dictionary',
				'/timeline',
				'/pressure-response',
				'/api-explorer',
				'/data-quality',
			],
		},
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
		{#each links as link (link.href)}
			{@const linkHref = `${base}${link.href}` as ResolvedPathname}
			<a href={linkHref} class:active={isActive(link, page.url.pathname)}>{link.label}</a>
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
	/*
	 * Metro word-list nav: no tab chrome, no rules, no fills. The active
	 * section is simply the bright word among dim ones — brightness and
	 * scale carry the state that a tab outline used to.
	 */
	nav {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 10px;
		flex-wrap: wrap;
		gap: 0;
	}

	.nav-links {
		display: flex;
		gap: 28px;
		flex-wrap: wrap;
		align-items: baseline;
	}

	a {
		padding: 0;
		font-size: var(--type-title);
		font-weight: var(--weight-display);
		letter-spacing: var(--track-display);
		text-transform: lowercase;
		color: var(--text-dim);
		text-decoration: none;
		background: transparent;
		transition:
			color 120ms ease-out,
			opacity 120ms ease-out;
	}

	a:hover {
		color: var(--text-muted);
	}

	/* Active carries two cues, not one: brightness (dim → ink) plus weight
	   (light → medium). A moderate 500 stays clear of Metro's heavy end so
	   the big type keeps its air. */
	a.active {
		color: var(--text);
		font-weight: 500;
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
		border: none;
		border-radius: var(--radius);
		background: transparent;
		color: var(--text-dim);
		cursor: pointer;
		padding: 0;
	}

	.settings-btn:hover {
		color: var(--accent);
	}

	.settings-dropdown {
		position: absolute;
		right: 0;
		top: calc(100% + 6px);
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 10px;
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
		font-size: var(--type-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		color: var(--text-dim);
		white-space: nowrap;
	}

	.toggle-btn {
		padding: 3px 10px;
		font-size: var(--type-caption);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: transparent;
		color: var(--text);
		cursor: pointer;
		font-weight: 600;
		white-space: nowrap;
	}

	.toggle-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
