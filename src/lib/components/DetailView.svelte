<script lang="ts">
	import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { unitPreference } from '$lib/unit-store.js';
	import { formatValue, getFieldLabel } from '$data/lib/units.js';
	import LoadingState from '$lib/components/LoadingState.svelte';
	import MultilineFieldBlock from '$lib/components/MultilineFieldBlock.svelte';
	import { inlineFields, multilineFieldValues } from '$lib/multiline-fields.js';

	let {
		item,
		fields,
		fieldGroups,
	}: {
		item: Record<string, any> | null;
		fields: AnyFieldDisplayDef[];
		fieldGroups: string[];
	} = $props();

	function isUrl(val: string): boolean {
		return val.startsWith('http://') || val.startsWith('https://');
	}
</script>

{#if item === null}
	<LoadingState />
{:else}
	{#each fieldGroups as group (group)}
		{@const groupFields = fields.filter((f) => f.group === group)}
		<!-- Free-text fields render as full-width blocks under the spec list
		     instead of a one-line <dd> — see $lib/multiline-fields.ts. -->
		{@const blocks = multilineFieldValues(item, groupFields)}
		{@const rowFields = inlineFields(groupFields)}
		{@const hasValues = rowFields.some((f) => f.getValue(item) !== '') || blocks.length > 0}
		{#if hasValues}
			<section class="field-group">
				<h2>{group}</h2>
				<dl>
					{#each rowFields as f (f.key)}
						{@const val = f.getValue(item)}
						{@const displayVal = f.getDisplayValue
							? f.getDisplayValue(item)
							: formatValue(val, f.unit, $unitPreference)}
						{@const href = f.getHref ? f.getHref(item) : null}
						{#if val}
							<div class="field-row">
								<dt>{getFieldLabel(f.label, f.unit, $unitPreference)}</dt>
								<dd>
									{#if href}
										{@const linkHref = `${base}${href}` as ResolvedPathname}
										<a href={linkHref}>{displayVal}</a>
									{:else if isUrl(val)}
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
										<a href={val} target="_blank" rel="noopener">{val}</a>
									{:else}
										{displayVal}
									{/if}
									{#if f.computed}
										<span class="computed-badge">computed</span>
									{/if}
								</dd>
							</div>
						{/if}
					{/each}
				</dl>
				{#each blocks as block (block.key)}
					<MultilineFieldBlock label={block.label} value={block.value} />
				{/each}
			</section>
		{/if}
	{/each}
{/if}

<style>
	.field-group {
		margin-bottom: 24px;
	}

	/* Section headings separate by wide-tracked caps and space rather than
	   by a rule under the text. */
	h2 {
		font-size: var(--type-micro);
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		margin-bottom: 10px;
		padding-bottom: 0;
	}

	dl {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0;
	}

	.field-row {
		display: flex;
		gap: 16px;
		padding: 6px 0;
		border-bottom: 1px solid var(--border-light);
	}

	dt {
		min-width: 180px;
		font-weight: 600;
		font-size: 13px;
		color: var(--text-muted);
	}

	dd {
		font-size: 13px;
		color: var(--text);
		word-break: break-all;
	}

	dd a {
		color: var(--accent);
		text-decoration: none;
	}

	dd a:hover {
		color: var(--accent-hover);
	}

	.computed-badge {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 5px;
		font-size: var(--type-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
		color: var(--text-dim);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		vertical-align: middle;
	}
</style>
