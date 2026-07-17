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

<style>
	/* A real warning, so it uses --warning rather than the accent, and
	   states itself with a heavy edge instead of a tinted panel. Ground is
	   neutral: an accent-tinted one would undercut the warning. */
	.schema-banner {
		background: var(--bg-card);
		color: var(--text);
		border-left: 4px solid var(--warning);
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
		background: var(--hover-bg);
		padding: 1px 5px;
		border-radius: var(--radius);
		font-size: 12px;
	}

	.local-data-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		background: var(--bg-card);
		color: var(--text-muted);
		text-align: center;
		padding: 6px 12px;
		font-size: var(--type-micro);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		margin: -24px -24px 16px -24px;
	}

	.local-data-banner.active {
		background: var(--accent);
		color: var(--accent-contrast);
	}

	.local-data-banner button {
		padding: 3px 10px;
		font-size: var(--type-micro);
		font-weight: 600;
		letter-spacing: var(--track-wide);
		border: 1px solid currentColor;
		border-radius: var(--radius);
		background: transparent;
		color: inherit;
		cursor: pointer;
		opacity: 0.85;
	}

	.local-data-banner button:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.15);
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
	 * --accent is the single emphasis colour (Metro cyan). It is
	 * deliberately the only chromatic token: swapping these two
	 * declarations re-accents the whole app.
	 *
	 * Cyan rather than the Zune orange we started with: orange sits ~3deg
	 * from --warning amber, so emphasis and "something is wrong" read as
	 * the same colour — fatal on a page like /data-quality. Cyan is ~160deg
	 * from --warning, ~169deg from --danger and ~112deg from --good, the
	 * widest separation available in the Metro palette.
	 *
	 * Grounds are #efefef / #222222 (not white / near-black). Both accents
	 * are tuned to clear WCAG AA on their own ground: light #1373a2 = 4.56,
	 * dark #1ba1e2 = 5.49. Surface tokens (bg-card, hover-bg, washes) sit
	 * *above* their ground in both themes — on a mid-value ground a darker
	 * "card" reads as a hole, which is what a naive flip produces.
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
		--accent: #1373a2;
		--accent-hover: #0f5f86;
		--accent-contrast: #fff;

		/*
		 * Status colours are deliberately NOT --accent: "this is emphasis"
		 * and "this is wrong" must not look alike. Values are darkened from
		 * the Metro palette for contrast on white.
		 */
		--good: #2d7b0e;
		--warning: #8a5a00;
		--danger: #c11200;

		/* Faint accent-tinted ground for "this cell matters" highlights
		   (compare diffs, filter pills). Not for text — pair with --text. */
		--accent-wash: #e4f0f8;
		--danger-wash: #f9e8e6;
		--bg: #efefef;
		--bg-card: #fafafa;
		--text: #111;
		--text-muted: #5c5c5c;
		--text-dim: #868686;
		--border: #d8d8d8;
		--border-light: #e4e4e4;
		--th-bg: transparent;
		--th-text: #818181;
		--hover-bg: #f6f6f6;
		--link: var(--accent);
		--pill-filter-bg: #e4f0f8;
		--pill-filter-border: #9cc6de;
		--pill-filter-hover: #d6e9f4;
		--pill-sort-bg: #e8e8e8;
		--pill-sort-border: #d0d0d0;
		--pill-sort-hover: #e0e0e0;
		--pill-col-bg: #e8e8e8;
		--pill-col-border: #d0d0d0;
		--pill-col-hover: #e0e0e0;
		--separator-color: #d8d8d8;
	}

	:global([data-theme='dark']) {
		--accent: #1ba1e2;
		--accent-hover: #5cc0f0;
		--accent-contrast: #000;

		/* Metro palette greens/reds, lifted for contrast on near-black. */
		--good: #7cc623;
		--warning: #f0a30a;
		--danger: #ff4d2e;

		--accent-wash: #1f3743;
		--danger-wash: #3a2320;
		--bg: #222222;
		--bg-card: #2b2b2b;
		--text: #fff;
		--text-muted: #9a9a9a;
		--text-dim: #6c6c6c;
		--border: #3d3d3d;
		--border-light: #2e2e2e;
		--th-bg: transparent;
		--th-text: #8e8e8e;
		--hover-bg: #2e2e2e;
		--link: var(--accent);
		--pill-filter-bg: #1f3743;
		--pill-filter-border: #2f6b8a;
		--pill-filter-hover: #27485a;
		--pill-sort-bg: #2b2b2b;
		--pill-sort-border: #444;
		--pill-sort-hover: #333;
		--pill-col-bg: #2b2b2b;
		--pill-col-border: #444;
		--pill-col-hover: #333;
		--separator-color: #3d3d3d;
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
