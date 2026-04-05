<script>
	import { theme } from '$lib/theme-store.js';
	let { children } = $props();

	let useLocalData = $state(false);

	$effect(() => {
		document.documentElement.setAttribute('data-theme', $theme);
	});

	$effect(() => {
		if (__DEV_LOCAL_DATA_AVAILABLE__) {
			useLocalData = document.cookie.includes('drawtab-local-data=1');
		}
	});

	function toggleDataSource() {
		if (useLocalData) {
			document.cookie = 'drawtab-local-data=0; path=/; max-age=0';
		} else {
			document.cookie = 'drawtab-local-data=1; path=/; max-age=31536000';
		}
		location.reload();
	}
</script>

{#if __DEV_LOCAL_DATA_AVAILABLE__}
	<div class="local-data-banner" class:active={useLocalData}>
		{#if useLocalData}
			Using local data repo
		{:else}
			Using submodule data
		{/if}
		<button onclick={toggleDataSource}>
			Switch to {useLocalData ? 'submodule' : 'local repo'}
		</button>
	</div>
{/if}
{@render children()}

<style>
	.local-data-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		background: #e5e7eb;
		color: #374151;
		text-align: center;
		padding: 6px 12px;
		font-size: 13px;
		font-weight: 600;
		margin: -24px -24px 16px -24px;
	}

	.local-data-banner.active {
		background: #f97316;
		color: #fff;
	}

	.local-data-banner button {
		padding: 3px 10px;
		font-size: 12px;
		font-weight: 600;
		border: 1px solid currentColor;
		border-radius: 4px;
		background: transparent;
		color: inherit;
		cursor: pointer;
		opacity: 0.85;
	}

	.local-data-banner button:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.15);
	}

	:global(:root) {
		--bg: #f5f5f5;
		--bg-card: #fff;
		--text: #222;
		--text-muted: #666;
		--text-dim: #999;
		--border: #e0e0e0;
		--border-light: #ddd;
		--th-bg: #f3f4f6;
		--th-text: #555;
		--hover-bg: #f0f7ff;
		--link: #2563eb;
		--pill-filter-bg: #fef3c7;
		--pill-filter-border: #fcd34d;
		--pill-filter-hover: #fde68a;
		--pill-sort-bg: #eef2ff;
		--pill-sort-border: #c7d2fe;
		--pill-sort-hover: #dbeafe;
		--pill-col-bg: #f0fdf4;
		--pill-col-border: #bbf7d0;
		--pill-col-hover: #dcfce7;
		--editor-bg: #fffbeb;
		--separator-color: #ddd;
	}

	:global([data-theme="dark"]) {
		--bg: #1a1a2e;
		--bg-card: #16213e;
		--text: #e0e0e0;
		--text-muted: #a0a0a0;
		--text-dim: #666;
		--border: #2a2a4a;
		--border-light: #2a2a4a;
		--th-bg: #1e2a45;
		--th-text: #c0c0c0;
		--hover-bg: #1e2a45;
		--link: #60a5fa;
		--pill-filter-bg: #4a3728;
		--pill-filter-border: #78591f;
		--pill-filter-hover: #5a4530;
		--pill-sort-bg: #1e2a45;
		--pill-sort-border: #3b5998;
		--pill-sort-hover: #253555;
		--pill-col-bg: #1a3328;
		--pill-col-border: #2d6b4f;
		--pill-col-hover: #234538;
		--editor-bg: #2a2218;
		--separator-color: #3a3a5a;
	}

	:global(*) { box-sizing: border-box; margin: 0; padding: 0; font-family: inherit; }

	:global(body) {
		font-family: "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		padding: 24px;
		background: var(--bg);
		color: var(--text);
	}

	:global(.step) {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 6px;
		padding: 10px 14px;
		font-size: 14px;
	}

	:global(.step-type) {
		font-weight: 600;
		color: #6b21a8;
		min-width: 60px;
		padding-top: 4px;
	}

	:global(.step-controls) {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		flex: 1;
	}

	:global(.step-controls select),
	:global(.step-controls input) {
		padding: 4px 8px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-card);
		color: var(--text);
	}

	:global(.step-controls input) { width: 160px; }

	:global(.step-remove) {
		background: none;
		border: none;
		color: var(--text-dim);
		cursor: pointer;
		font-size: 18px;
		padding: 2px 6px;
		line-height: 1;
	}

	:global(.step-remove:hover) { color: #e11d48; }

	:global(.pipe-connector) {
		padding: 2px 0 2px 18px;
		color: var(--text-dim);
		font-size: 18px;
		line-height: 1;
	}

	:global(.results-bar) {
		font-size: 14px;
		color: var(--text-muted);
		margin-bottom: 10px;
	}

	:global(.table-wrap) { overflow-x: auto; }

	:global(table) {
		width: 100%;
		border-collapse: collapse;
		background: var(--bg-card);
		font-size: 13px;
	}

	:global(th), :global(td) {
		text-align: left;
		padding: 6px 10px;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	:global(th) {
		background: var(--th-bg);
		color: var(--th-text);
		font-weight: 600;
		position: sticky;
		top: 0;
		border-bottom: 2px solid var(--border);
	}

	:global(tr:hover td) { background: var(--hover-bg); }

	:global(.dim) { color: var(--text-dim); }

	:global(a) { color: var(--link); }
</style>
