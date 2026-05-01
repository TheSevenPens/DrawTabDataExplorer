<script lang="ts">
	import Nav from '$lib/components/Nav.svelte';
	import SubNav from '$lib/components/SubNav.svelte';

	const PEN_PRESSURE_DATA_URL = 'https://thesevenpens.github.io/PenPressureData/';

	const penTabs = [
		{ href: '/pens', label: 'Pen models' },
		{ href: '/pen-families', label: 'Pen families' },
		{ href: '/pen-inventory', label: 'Inventory' },
		{ href: '/pressure-response', label: 'Pressure Response' },
	];
</script>

<Nav />
<SubNav tabs={penTabs} />

<h1>Pressure Response</h1>

<div class="card">
	<p>Pen pressure data has moved to a dedicated tool with a better viewing experience:</p>
	<p>
		<a class="cta" href={PEN_PRESSURE_DATA_URL} target="_blank" rel="noopener">
			Open PenPressureData →
		</a>
	</p>
	<p class="note">
		The pressure-response viewer that previously lived here is being rebuilt in PenPressureData.
		We'll bring those features back into this site once the new UX has been refined.
	</p>
</div>

<style>
	h1 {
		margin-bottom: 16px;
	}

	.card {
		max-width: 600px;
		padding: 24px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-card);
	}

	.card p {
		margin: 0 0 12px;
		font-size: 14px;
		line-height: 1.5;
	}

	.card p:last-child {
		margin-bottom: 0;
	}

	.cta {
		display: inline-block;
		padding: 8px 16px;
		background: #2563eb;
		color: #fff;
		text-decoration: none;
		border-radius: 4px;
		font-weight: 500;
	}

	.cta:hover {
		background: #1d4ed8;
	}

	.note {
		font-size: 13px;
		color: var(--text-muted);
		font-style: italic;
	}
</style>
