<script lang="ts">
	import { base } from '$app/paths';
	import { type Brand, BRAND_FIELDS, BRAND_FIELD_GROUPS } from '$data/lib/entities/brand-fields.js';
	import { type Tablet } from '$data/lib/drawtab-loader.js';
	import DetailView from '$lib/components/DetailView.svelte';
	import Nav from '$lib/components/Nav.svelte';

	let { data } = $props();

	const brand: Brand = data.brand;
	const tablets: Tablet[] = data.tablets;
</script>

<Nav />

<div class="title-row">
	<h1>{brand.BrandName}</h1>
</div>

<DetailView
	item={brand}
	fields={BRAND_FIELDS}
	fieldGroups={BRAND_FIELD_GROUPS}
	backHref="/brands"
	backLabel="All brands"
/>

{#if tablets.length > 0}
	<section class="tablets-section">
		<h2>Tablets ({tablets.length})</h2>
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Type</th>
					<th>Year</th>
				</tr>
			</thead>
			<tbody>
				{#each tablets.sort((a, b) => (b.Model.LaunchYear ?? '').localeCompare(a.Model.LaunchYear ?? '')) as t}
					<tr>
						<td><a class="entity-link" href="{base}/tablets/{encodeURIComponent(t.Meta.EntityId)}">{t.Model.Name} ({t.Model.Id})</a></td>
						<td>{t.Model.Type}</td>
						<td>{t.Model.LaunchYear ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<style>
	.title-row {
		margin-bottom: 16px;
	}

	h1 { margin: 0; }

	.tablets-section {
		margin-top: 24px;
	}

	.tablets-section h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid var(--border);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	th {
		text-align: left;
		padding: 6px 10px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}

	td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}

	.entity-link {
		color: var(--link);
		text-decoration: none;
	}

	.entity-link:hover {
		text-decoration: underline;
	}
</style>
