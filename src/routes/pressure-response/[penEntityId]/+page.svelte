<script lang="ts">
	import { page } from '$app/state';
	import Nav from '$lib/components/Nav.svelte';

	const PEN_PRESSURE_DATA_URL = 'https://thesevenpens.github.io/PenPressureData/';

	let penEntityId = $derived(decodeURIComponent(page.params.penEntityId ?? ''));
</script>

<Nav />

<h1>Pressure Response: {penEntityId}</h1>

<div class="card">
	<p>
		Per-pen pressure-response charts have moved to a dedicated tool with a
		better viewing experience:
	</p>
	<p>
		<a class="cta" href={PEN_PRESSURE_DATA_URL} target="_blank" rel="noopener">
			Open PenPressureData →
		</a>
	</p>
	<p class="note">
		Look for <code>{penEntityId}</code> in the PenPressureData listing.
	</p>
</div>

<style>
	h1 {
		margin-bottom: 16px;
		font-size: 18px;
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
	}

	code {
		background: var(--code-bg, rgba(0, 0, 0, 0.05));
		padding: 1px 6px;
		border-radius: 3px;
		font-size: 12px;
	}
</style>
