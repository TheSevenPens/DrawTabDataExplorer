<script lang="ts">
	import type { AnyFieldDisplayDef } from '@thesevenpens/queriton';
	import { base } from '$app/paths';
	import type { ResolvedPathname } from '$app/types';
	import { unitPreference } from '$lib/unit-store.js';
	import { formatValue, getFieldLabel } from '$data/lib/units.js';
	import LoadingState from '$lib/components/LoadingState.svelte';

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
		{@const hasValues = groupFields.some((f) => f.getValue(item) !== '')}
		{#if hasValues}
			<section class="field-group">
				<h2>{group}</h2>
				<dl>
					{#each groupFields as f (f.key)}
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
