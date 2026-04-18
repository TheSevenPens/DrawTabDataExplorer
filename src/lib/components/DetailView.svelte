<script lang="ts">
	import type { FieldDef } from '$data/lib/pipeline/index.js';
	import { base } from '$app/paths';
	import { unitPreference } from '$lib/unit-store.js';
	import { formatValue, getFieldLabel } from '$data/lib/units.js';

	let { item, fields, fieldGroups }: {
		item: Record<string, any> | null;
		fields: FieldDef<any>[];
		fieldGroups: string[];
	} = $props();

	function isUrl(val: string): boolean {
		return val.startsWith('http://') || val.startsWith('https://');
	}
</script>

{#if item === null}
	<p>Loading...</p>
{:else}
	{#each fieldGroups as group}
		{@const groupFields = fields.filter((f) => f.group === group)}
		{@const hasValues = groupFields.some((f) => f.getValue(item) !== '')}
		{#if hasValues}
			<section class="field-group">
				<h2>{group}</h2>
				<dl>
					{#each groupFields as f}
						{@const val = f.getValue(item)}
						{@const displayVal = f.getDisplayValue ? f.getDisplayValue(item) : formatValue(val, f.unit, $unitPreference)}
						{@const href = f.getHref ? f.getHref(item) : null}
						{#if val}
							<div class="field-row">
								<dt>{getFieldLabel(f.label, f.unit, $unitPreference)}</dt>
								<dd>
									{#if href}
										<a href="{base}{href}">{displayVal}</a>
									{:else if isUrl(val)}
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

	h2 {
		font-size: 15px;
		font-weight: 600;
		color: #6b21a8;
		margin-bottom: 8px;
		padding-bottom: 4px;
		border-bottom: 2px solid var(--border);
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
		border-bottom: 1px solid var(--border);
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
		color: #2563eb;
		text-decoration: none;
	}

	dd a:hover { text-decoration: underline; }

	.computed-badge {
		display: inline-block;
		margin-left: 6px;
		padding: 1px 5px;
		font-size: 10px;
		color: var(--text-dim);
		border: 1px solid var(--border-light);
		border-radius: 3px;
		vertical-align: middle;
	}
</style>
