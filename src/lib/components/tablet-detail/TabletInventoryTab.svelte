<script lang="ts">
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { resolve } from '$app/paths';
	import type { InventoryTablet } from '$data/lib/entities/inventory-tablet-fields.js';

	let { inventoryUnits }: { inventoryUnits: InventoryTablet[] } = $props();
</script>

{#if inventoryUnits.length > 0}
	<table class="compat-table">
		<thead>
			<tr>
				<th>Inventory ID</th>
				<th>Vendor</th>
				<th>Order Date</th>
				<th>Defective</th>
			</tr>
		</thead>
		<tbody>
			{#each inventoryUnits as u (u._id)}
				<tr>
					<td><a href={resolve('/tablet-inventory/[id]', { id: u._id })}>{u.InventoryId}</a></td>
					<td>{u.Vendor || ''}</td>
					<td>{u.OrderDate || ''}</td>
					<td>{(u.Defects?.length ?? 0) > 0 ? 'YES' : ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<EmptyState>You don't own a unit of this tablet model.</EmptyState>
{/if}

<style>
	.compat-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}
	.compat-table th {
		text-align: left;
		padding: 6px 10px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
	}
	.compat-table td {
		padding: 5px 10px;
		border-bottom: 1px solid var(--border);
	}
	.compat-table a {
		color: var(--link);
		text-decoration: none;
	}
	.compat-table a:hover {
		text-decoration: underline;
	}
</style>
