<script lang="ts">
	// Shared command button for the app (GitHub #239). Replaces the ~20 one-off
	// `.copy-btn` / `.add-btn` / `.clear-btn` / `.run-btn` styles scattered across
	// routes with a small, boring variant set. Body stays a snippet so callers
	// keep their label/icon markup; styling + a11y live here.
	import type { Snippet } from 'svelte';
	import { resolveButtonTitle, type ButtonVariant, type ButtonSize } from './button-helpers.js';

	let {
		variant = 'secondary',
		size = 'sm',
		type = 'button',
		disabled = false,
		disabledReason,
		title,
		pressed,
		onclick,
		children,
		...rest
	}: {
		variant?: ButtonVariant;
		size?: ButtonSize;
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		/** When disabled, shown as the tooltip so the reason is discoverable. */
		disabledReason?: string;
		title?: string;
		/** aria-pressed for toggle buttons; omit for plain command buttons. */
		pressed?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
		[key: string]: unknown;
	} = $props();

	let resolvedTitle = $derived(resolveButtonTitle({ disabled, disabledReason, title }));
</script>

<button
	{type}
	class="btn"
	class:primary={variant === 'primary'}
	class:secondary={variant === 'secondary'}
	class:subtle={variant === 'subtle'}
	class:danger={variant === 'danger'}
	class:icon={variant === 'icon'}
	class:menu-trigger={variant === 'menu-trigger'}
	class:md={size === 'md'}
	class:sm={size === 'sm'}
	{disabled}
	title={resolvedTitle}
	aria-pressed={pressed}
	aria-haspopup={variant === 'menu-trigger' ? 'menu' : undefined}
	{onclick}
	{...rest}
>
	{@render children()}
</button>

<style>
	/*
	 * Metro buttons are square outlines on the page ground, not raised
	 * chips: no radius, no fill by default, no shadow. Only `primary`
	 * spends the accent as a fill — everything else states itself with an
	 * edge, so a screen full of commands stays quiet.
	 *
	 * Labels are wide-tracked caps at the small size, matching the
	 * toolbar/table-header voice established in +layout.svelte.
	 */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-family: inherit;
		border: 1px solid transparent;
		border-radius: var(--radius);
		line-height: 1;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	/* sizes */
	.btn.sm {
		padding: 4px 9px;
		font-size: var(--type-micro);
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
	}
	.btn.md {
		padding: 6px 16px;
		font-size: var(--type-caption);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--track-wide);
	}

	/* primary — filled accent (run/save/add primary actions) */
	.btn.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-contrast);
		font-weight: 600;
	}
	.btn.primary:hover:not(:disabled) {
		background: var(--accent-hover);
		border-color: var(--accent-hover);
	}

	/* secondary — outline accent */
	.btn.secondary {
		background: transparent;
		border-color: var(--accent);
		color: var(--accent);
		font-weight: 600;
	}
	.btn.secondary:hover:not(:disabled) {
		background: var(--accent);
		color: var(--accent-contrast);
	}

	/* subtle — neutral, for copy/toolbar commands */
	.btn.subtle {
		background: transparent;
		border-color: var(--border);
		color: var(--text-muted);
	}
	.btn.subtle:hover:not(:disabled) {
		background: var(--hover-bg);
		border-color: var(--text-dim);
		color: var(--text);
	}

	/* danger — destructive (clear/delete/remove) */
	.btn.danger {
		background: transparent;
		border-color: var(--danger);
		color: var(--danger);
	}
	.btn.danger:hover:not(:disabled) {
		background: var(--danger);
		border-color: var(--danger);
		color: #fff;
	}

	/* icon — compact, icon-only */
	.btn.icon {
		padding: 4px 6px;
		background: none;
		border-color: transparent;
		color: var(--text-muted);
		text-transform: none;
		letter-spacing: normal;
	}
	.btn.icon:hover:not(:disabled) {
		background: transparent;
		color: var(--accent);
	}

	/* menu-trigger — opens an anchored PopoverMenu (#232/#234) */
	.btn.menu-trigger {
		background: transparent;
		border-color: var(--border);
		color: var(--text-muted);
	}
	.btn.menu-trigger:hover:not(:disabled) {
		background: var(--hover-bg);
		color: var(--text);
	}

	/* toggle pressed state (used with subtle/menu-trigger for view toggles) */
	.btn[aria-pressed='true'] {
		color: var(--accent);
		border-color: var(--accent);
		font-weight: 600;
	}
</style>
