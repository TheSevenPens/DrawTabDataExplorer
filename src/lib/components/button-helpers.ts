// Pure helpers behind Button.svelte (GitHub #239). The variant/size union
// types are the single source of truth for the button system; resolveButtonTitle
// holds the one non-obvious behavior (disabled buttons surface their reason as a
// tooltip), so it lives here and is unit-tested independently of the component.

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'danger' | 'icon' | 'menu-trigger';
export type ButtonSize = 'sm' | 'md';

/**
 * Resolve a button's `title` (tooltip). When a button is disabled and a reason
 * was supplied, the reason wins so the disabled state is discoverable on hover;
 * otherwise the explicit title (if any) is used.
 */
export function resolveButtonTitle(opts: {
	disabled?: boolean;
	disabledReason?: string;
	title?: string;
}): string | undefined {
	if (opts.disabled && opts.disabledReason) return opts.disabledReason;
	return opts.title;
}
