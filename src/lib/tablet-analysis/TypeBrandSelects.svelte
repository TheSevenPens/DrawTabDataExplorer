<script lang="ts">
	import { brandName } from '$data/lib/drawtab-loader.js';

	let {
		types,
		type = '',
		onTypeChange,
		brands,
		brand,
		onBrandChange,
	}: {
		/** Type choices; the Type dropdown is left out when omitted. */
		types?: { value: string; label: string }[];
		type?: string;
		onTypeChange?: (t: string) => void;
		brands: string[];
		brand: string;
		onBrandChange: (b: string) => void;
	} = $props();
</script>

{#if types}
	<label class="show-count">
		Type
		<select onchange={(e) => onTypeChange?.(e.currentTarget.value)}>
			<option value="" selected={type === ''}>All types</option>
			{#each types as t (t.value)}
				<option value={t.value} selected={type === t.value}>{t.label}</option>
			{/each}
		</select>
	</label>
{/if}
<label class="show-count">
	Brand
	<select onchange={(e) => onBrandChange(e.currentTarget.value)}>
		<option value="" selected={brand === ''}>All brands</option>
		{#each brands as b (b)}
			<option value={b} selected={brand === b}>{brandName(b)}</option>
		{/each}
	</select>
</label>
