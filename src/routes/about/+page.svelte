<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';

	// `version` comes from the root +layout.ts load, merged into every page's
	// data. It used to sit in a footer on every page; it lives here now.
	let { data } = $props();
	let version = $derived(data.version);
</script>

<Nav />

<h1 class="sr-only">About</h1>

<section class="about-section">
	<h2>DrawTab Data Explorer</h2>
</section>

<section class="about-section">
	<h2>Data Source</h2>
	<p>
		All data comes from the <a
			href="https://github.com/TheSevenPens/DrawTabData"
			target="_blank"
			rel="noopener noreferrer">DrawTabData</a
		>
		repository — an open dataset of graphics tablet and pen specifications maintained by
		<a href="https://www.youtube.com/@SevenPens" target="_blank" rel="noopener noreferrer"
			>Seven Pens</a
		>.
	</p>
	<ul class="link-list">
		<li>
			<a
				href="https://github.com/TheSevenPens/DrawTabData"
				target="_blank"
				rel="noopener noreferrer"
			>
				DrawTabData on GitHub
			</a>
			— the source data
		</li>
		<li>
			<a
				href="https://github.com/TheSevenPens/DrawTabDataExplorer"
				target="_blank"
				rel="noopener noreferrer"
			>
				DrawTabDataExplorer on GitHub
			</a>
			— the source code
		</li>
	</ul>
</section>

<section class="about-section">
	<h2>Dataset version</h2>
	{#if version}
		<p>
			Data <strong>{version.version}</strong>, from DrawTabData commit
			<a
				class="commit"
				href="https://github.com/TheSevenPens/DrawTabData/commit/{version.commit}"
				target="_blank"
				rel="noopener noreferrer">{version.shortCommit}</a
			>.
		</p>
		<p>
			{version.counts.tablets} tablets, {version.counts.pens} pens, {version.counts.drivers} drivers,
			{version.counts.brands} brands.
		</p>
	{:else}
		<p class="dim">Dataset version unavailable.</p>
	{/if}
</section>

<section class="about-section">
	<h2>Other Tools consuming the same data</h2>
	<ul class="link-list">
		<li>
			<a
				href="https://thesevenpens.github.io/PenPressureData/"
				target="_blank"
				rel="noopener noreferrer"
			>
				Pen Pressure Data
			</a>
			— pen pressure response measurements and visualizations (Deprecated)
		</li>
		<li>
			<a
				href="https://thesevenpens.github.io/DrawTabInventory/"
				target="_blank"
				rel="noopener noreferrer"
			>
				DrawTab Inventory
			</a>
			— personal tablet and pen inventory tracker (Deprecated)
		</li>
		<li>
			<a
				href="https://thesevenpens.github.io/DrawTabPenCompat/"
				target="_blank"
				rel="noopener noreferrer"
			>
				DrawTab Pen Compat
			</a>
			— pen and tablet compatibility reference (Deprecated)
		</li>
	</ul>
</section>

<style>
	.about-section {
		margin-bottom: 32px;
		max-width: 680px;
	}

	.about-section h2 {
		font-size: 16px;
		font-weight: 600;
		margin: 0 0 10px;
		color: var(--text);
	}

	.about-section p {
		font-size: 14px;
		line-height: 1.6;
		color: var(--text);
		margin: 0 0 10px;
	}

	.about-section a {
		color: var(--link);
		text-decoration: none;
	}

	.about-section a:hover {
		text-decoration: underline;
	}

	.commit {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.link-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.link-list li {
		font-size: 14px;
		padding: 4px 0;
		color: var(--text);
	}
</style>
