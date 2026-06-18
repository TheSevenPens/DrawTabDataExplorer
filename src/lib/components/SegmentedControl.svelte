<script lang="ts" generics="T extends string">
	// Shared segmented control for the repeated view/mode toggles (GitHub #239):
	// JSON↔Table (api-explorer), Summary↔By-unit↔By-sample (PressureRangeTab),
	// and similar two/three-option switches that each hand-rolled a `.view-toggle`.
	// Generic over the value type so a `'json' | 'table'` union binds type-safely.
	interface Option {
		value: T;
		label: string;
	}

	let {
		options,
		value = $bindable(),
		onchange,
		ariaLabel,
	}: {
		options: Option[];
		value: T;
		onchange?: (value: T) => void;
		ariaLabel?: string;
	} = $props();

	function select(v: T) {
		if (v === value) return;
		value = v;
		onchange?.(v);
	}
</script>

<div class="segmented" role="group" aria-label={ariaLabel}>
	{#each options as opt (opt.value)}
		<button
			type="button"
			class:active={value === opt.value}
			aria-pressed={value === opt.value}
			onclick={() => select(opt.value)}>{opt.label}</button
		>
	{/each}
</div>

<style>
	.segmented {
		display: inline-flex;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}

	.segmented button {
		appearance: none;
		border: none;
		background: var(--bg-card);
		color: var(--text-muted);
		padding: 2px 10px;
		font-size: 12px;
		font-family: inherit;
		cursor: pointer;
		border-right: 1px solid var(--border);
	}

	.segmented button:last-child {
		border-right: none;
	}

	.segmented button:hover {
		color: var(--text);
	}

	.segmented button.active {
		background: var(--bg);
		color: var(--text);
		font-weight: 600;
	}
</style>
