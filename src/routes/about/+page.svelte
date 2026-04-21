<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
</script>

<Nav />

<h1>About</h1>

<section class="about-section">
	<h2>DrawTab Data Explorer</h2>
	<p>
		DrawTab Data Explorer is a searchable, filterable reference tool for graphics tablet and pen
		specifications. It lets you browse, compare, and explore detailed hardware data for tablets
		and pens from brands like Wacom, Huion, XP-Pen, Xencelabs, and others.
	</p>
</section>

<section class="about-section">
	<h2>Data Source</h2>
	<p>
		All data comes from the <a href="https://github.com/TheSevenPens/DrawTabData" target="_blank" rel="noopener noreferrer">DrawTabData</a>
		repository — an open dataset of graphics tablet and pen specifications maintained by
		<a href="https://www.youtube.com/@SevenPens" target="_blank" rel="noopener noreferrer">TheSevenPens</a>.
		The data covers digitizer dimensions, pressure levels, tilt support, pen compatibility,
		driver information, and more.
	</p>
	<ul class="link-list">
		<li>
			<a href="https://github.com/TheSevenPens/DrawTabData" target="_blank" rel="noopener noreferrer">
				DrawTabData on GitHub
			</a>
			— the source dataset powering this site
		</li>
		<li>
			<a href="https://github.com/TheSevenPens/DrawTabDataExplorer" target="_blank" rel="noopener noreferrer">
				DrawTabDataExplorer on GitHub
			</a>
			— the source code for this site
		</li>
	</ul>
</section>

<section class="about-section">
	<h2>Other Tools Using This Data</h2>
	<ul class="link-list">
		<li>
			<a href="https://thesevenpens.github.io/PenPressureData/" target="_blank" rel="noopener noreferrer">
				Pen Pressure Data
			</a>
			— pen pressure response measurements and visualizations
		</li>
		<li>
			<a href="https://thesevenpens.github.io/DrawTabInventory/" target="_blank" rel="noopener noreferrer">
				DrawTab Inventory
			</a>
			— personal tablet and pen inventory tracker
		</li>
		<li>
			<a href="https://thesevenpens.github.io/DrawTabPenCompat/" target="_blank" rel="noopener noreferrer">
				DrawTab Pen Compat
			</a>
			— pen and tablet compatibility reference
		</li>
	</ul>
</section>

<style>
	h1 { margin-bottom: 24px; }

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

	.about-section a:hover { text-decoration: underline; }

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
