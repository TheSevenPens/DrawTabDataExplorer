<script lang="ts">
	import { theme } from '$lib/theme-store.js';
	import DevErrorBanner from '$lib/components/DevErrorBanner.svelte';
	import ModalRoot from '$lib/components/ModalRoot.svelte';
	import { SUPPORTED_SCHEMA_MAJOR } from '$lib/schema-version.js';
	let { children, data } = $props();

	let version = $derived(data.version);

	// Compatibility status: "ok" when the dataset's schemaVersion matches
	// what this app supports; "mismatch" when it doesn't; "missing" when
	// version.json is unavailable (corrupt/missing dataset).
	let schemaStatus = $derived.by((): 'ok' | 'mismatch' | 'missing' => {
		if (!version) return 'missing';
		if (typeof version.schemaVersion !== 'number') return 'missing';
		return version.schemaVersion === SUPPORTED_SCHEMA_MAJOR ? 'ok' : 'mismatch';
	});

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

{#if schemaStatus !== 'ok'}
	<div class="schema-banner" role="alert">
		{#if schemaStatus === 'missing'}
			<strong>Dataset version unavailable.</strong>
			This build expects schema v{SUPPORTED_SCHEMA_MAJOR} but couldn't read
			<code>version.json</code> — the data submodule may be missing or misconfigured. See the
			<a
				href="https://github.com/TheSevenPens/DrawTabDataExplorer#setup"
				target="_blank"
				rel="noopener">setup guide</a
			>.
		{:else}
			<strong>Schema mismatch.</strong>
			Dataset is schema v{version?.schemaVersion}; this app supports v{SUPPORTED_SCHEMA_MAJOR}. Some
			pages may render incorrectly. Update the explorer or roll the dataset back — see the
			<a
				href="https://github.com/TheSevenPens/DrawTabDataExplorer#setup"
				target="_blank"
				rel="noopener">setup guide</a
			>.
		{/if}
	</div>
{/if}
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

<ModalRoot />

{#if import.meta.env.DEV}
	<DevErrorBanner />
{/if}

{#if version}
	<footer class="data-version">
		<span>Data {version.version}</span>
		<span class="sep">·</span>
		<a
			href="https://github.com/TheSevenPens/DrawTabData/commit/{version.commit}"
			target="_blank"
			rel="noopener"
		>
			{version.shortCommit}
		</a>
		<span class="sep">·</span>
		<span>
			{version.counts.tablets} tablets,
			{version.counts.pens} pens,
			{version.counts.drivers} drivers,
			{version.counts.brands} brands
		</span>
	</footer>
{/if}

<style>
	.schema-banner {
		background: #fef3c7;
		color: #78350f;
		border-bottom: 2px solid #f59e0b;
		padding: 10px 16px;
		font-size: 13px;
		line-height: 1.4;
		margin: -24px -24px 16px -24px;
	}

	.schema-banner a {
		color: inherit;
		text-decoration: underline;
	}

	.schema-banner code {
		background: rgba(0, 0, 0, 0.06);
		padding: 1px 5px;
		border-radius: 3px;
		font-size: 12px;
	}

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

	.data-version {
		margin: 32px -24px -24px -24px;
		padding: 10px 24px;
		border-top: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-muted);
		font-size: 12px;
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}

	.data-version .sep {
		color: var(--text-dim);
	}

	.data-version a {
		color: var(--link);
		text-decoration: none;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.data-version a:hover {
		text-decoration: underline;
	}

	/*
	 * Metro design tokens.
	 *
	 * Hierarchy comes from type scale and opacity, not from cards and
	 * borders — so surface tokens sit very close to --bg and borders are
	 * near-invisible by design. If something looks flat and undivided,
	 * that is the intent; reach for type scale or whitespace to separate
	 * it, not for a box.
	 *
	 * --accent is the single emphasis colour (Zune orange). It is
	 * deliberately the only chromatic token: swapping these two
	 * declarations re-accents the whole app.
	 */
	:global(:root) {
		/* Type scale */
		--type-display: clamp(44px, 6.5vw, 76px);
		--type-title: 34px;
		--type-heading: 24px;
		--type-subhead: 18px;
		--type-body: 14px;
		--type-caption: 12px;
		--type-micro: 11px;

		/* Metro sets big type tight and small caps-labels loose. */
		--track-display: -0.03em;
		--track-tight: -0.015em;
		--track-wide: 0.12em;

		--weight-display: 300;

		/* Metro is square. */
		--radius: 0;

		/* Light theme */
		--accent: #a85400;
		--accent-hover: #d06a00;
		--accent-contrast: #fff;

		/*
		 * Status colours are deliberately NOT --accent: "this is emphasis"
		 * and "this is wrong" must not look alike. Values are darkened from
		 * the Metro palette for contrast on white.
		 *
		 * Caveat: --warning is amber and --accent is orange, so they are
		 * close in hue by construction. Status here leans on wording and
		 * placement, not hue alone.
		 */
		--good: #2e7d0e;
		--warning: #8a5a00;
		--danger: #c11200;
		--bg: #fff;
		--bg-card: #fafafa;
		--text: #111;
		--text-muted: #5c5c5c;
		--text-dim: #8e8e8e;
		--border: #e6e6e6;
		--border-light: #f0f0f0;
		--th-bg: transparent;
		--th-text: #8e8e8e;
		--hover-bg: #f5f5f5;
		--link: var(--accent);
		--pill-filter-bg: #fdf6ee;
		--pill-filter-border: #e8c9a4;
		--pill-filter-hover: #f8ead9;
		--pill-sort-bg: #f2f2f2;
		--pill-sort-border: #d6d6d6;
		--pill-sort-hover: #e8e8e8;
		--pill-col-bg: #f2f2f2;
		--pill-col-border: #d6d6d6;
		--pill-col-hover: #e8e8e8;
		--editor-bg: #fafafa;
		--separator-color: #e6e6e6;
	}

	:global([data-theme='dark']) {
		--accent: #f09609;
		--accent-hover: #ffb03a;
		--accent-contrast: #000;

		/* Metro palette greens/reds, lifted for contrast on near-black. */
		--good: #7cc623;
		--warning: #f0a30a;
		--danger: #ff4d2e;
		--bg: #0a0a0a;
		--bg-card: #141414;
		--text: #fff;
		--text-muted: #9a9a9a;
		--text-dim: #5e5e5e;
		--border: #242424;
		--border-light: #1c1c1c;
		--th-bg: transparent;
		--th-text: #7d7d7d;
		--hover-bg: #171717;
		--link: var(--accent);
		--pill-filter-bg: #1e1508;
		--pill-filter-border: #6b4a12;
		--pill-filter-hover: #2a1e0c;
		--pill-sort-bg: #161616;
		--pill-sort-border: #333;
		--pill-sort-hover: #1f1f1f;
		--pill-col-bg: #161616;
		--pill-col-border: #333;
		--pill-col-hover: #1f1f1f;
		--editor-bg: #141414;
		--separator-color: #242424;
	}

	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
		font-family: inherit;
	}

	:global(body) {
		/* Open Sans shares its designer (Steve Matteson) and humanist
		   skeleton with Segoe UI; Segoe is kept next in the stack so
		   Windows can serve the real thing before the webfont lands. */
		font-family:
			'Open Sans',
			'Segoe UI',
			-apple-system,
			BlinkMacSystemFont,
			Roboto,
			sans-serif;
		padding: 24px;
		background: var(--bg);
		color: var(--text);
		font-size: var(--type-body);
		letter-spacing: var(--track-tight);
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
		color: var(--text);
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

	:global(.step-controls input) {
		width: 160px;
	}

	:global(.step-remove) {
		background: none;
		border: none;
		color: var(--text-dim);
		cursor: pointer;
		font-size: 18px;
		padding: 2px 6px;
		line-height: 1;
	}

	:global(.step-remove:hover) {
		color: #e11d48;
	}

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

	:global(.table-wrap) {
		overflow-x: auto;
	}

	:global(table) {
		width: 100%;
		border-collapse: collapse;
		background: transparent;
		font-size: 13px;
	}

	:global(th),
	:global(td) {
		text-align: left;
		padding: 7px 10px;
		border-bottom: 1px solid var(--border-light);
		white-space: nowrap;
	}

	/* Metro column headers: small, wide-tracked caps carrying no fill or
	   rule of their own — the type does the work. */
	:global(th) {
		background: var(--bg);
		color: var(--th-text);
		font-weight: 600;
		font-size: var(--type-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		position: sticky;
		top: 0;
		border-bottom: 1px solid var(--border);
	}

	:global(tr:hover td) {
		background: var(--hover-bg);
	}

	:global(.dim) {
		color: var(--text-dim);
	}

	/* Available to screen readers and the document outline, painted
	   nowhere. Used where Metro drops a visible heading that the page
	   still needs structurally (e.g. EntityExplorer's page title, which
	   the Nav already states in type). */
	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	:global(a) {
		color: var(--link);
	}
</style>
