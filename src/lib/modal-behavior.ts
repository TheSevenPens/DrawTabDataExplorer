// One implementation of modal keyboard behaviour for every `aria-modal`
// dialog (PickerModalShell, ExportDialog, ModalRoot — GitHub #335). Each of
// them declared `aria-modal="true"` but let Tab walk straight out of the
// dialog into the page behind it; in the Add Tablet picker, Tab from the last
// button landed on <body>.
//
// Use as a Svelte action on the dialog element:
//
//   <div role="dialog" aria-modal="true" use:modalBehavior={{ onclose }}>
//
// While mounted it:
//   - moves focus into the dialog (unless something inside already has it),
//   - marks everything outside the dialog `inert`, so neither Tab, a screen
//     reader's virtual cursor, nor a click reaches the page behind,
//   - wraps Tab / Shift+Tab between the first and last focusable element,
//   - calls `onclose` on Escape (when given),
// and on destroy restores the `inert` state it changed and returns focus to
// the element that had it before the dialog opened.

const FOCUSABLE = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled]):not([type="hidden"])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

/** Tabbable elements inside `root`, in DOM order. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
	return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
		(el) => !el.closest('[inert]') && !el.hidden,
	);
}

/**
 * Where Tab should go from `current`, or null to let the browser move focus
 * normally. Only the edges wrap: Tab on the last element goes to the first,
 * Shift+Tab on the first goes to the last. Focus outside the list (e.g. on
 * the dialog itself) goes to the first or last element.
 */
export function wrapTarget(
	items: readonly HTMLElement[],
	current: Element | null,
	backwards: boolean,
): HTMLElement | null {
	if (items.length === 0) return null;
	const i = current ? items.indexOf(current as HTMLElement) : -1;
	if (i === -1) return backwards ? items[items.length - 1] : items[0];
	if (!backwards && i === items.length - 1) return items[0];
	if (backwards && i === 0) return items[items.length - 1];
	return null;
}

/** Set `inert` on every sibling along the path from `node` up to <body>,
 * returning the elements it changed so they can be restored. */
function inertOutside(node: HTMLElement): HTMLElement[] {
	const changed: HTMLElement[] = [];
	let el: HTMLElement = node;
	while (el.parentElement && el !== document.body) {
		for (const sib of el.parentElement.children) {
			if (sib === el || !(sib instanceof HTMLElement) || sib.hasAttribute('inert')) continue;
			if (sib.tagName === 'SCRIPT' || sib.tagName === 'STYLE') continue;
			sib.setAttribute('inert', '');
			changed.push(sib);
		}
		el = el.parentElement;
	}
	return changed;
}

export interface ModalBehaviorOptions {
	/** Called on Escape. Omit when the dialog handles Escape itself. */
	onclose?: () => void;
}

export function modalBehavior(node: HTMLElement, options: ModalBehaviorOptions = {}) {
	let opts = options;
	const opener = document.activeElement as HTMLElement | null;
	const inerted = inertOutside(node);

	// Children's onMount (e.g. a picker focusing its search box) runs before
	// this frame, so only take focus if nothing inside the dialog has it.
	const raf = requestAnimationFrame(() => {
		if (node.contains(document.activeElement)) return;
		(focusableWithin(node)[0] ?? node).focus();
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && opts.onclose) {
			e.preventDefault();
			opts.onclose();
			return;
		}
		if (e.key !== 'Tab') return;
		const target = wrapTarget(focusableWithin(node), document.activeElement, e.shiftKey);
		if (target) {
			e.preventDefault();
			target.focus();
		}
	}
	document.addEventListener('keydown', onKeydown);

	return {
		update(next: ModalBehaviorOptions = {}) {
			opts = next;
		},
		destroy() {
			cancelAnimationFrame(raf);
			document.removeEventListener('keydown', onKeydown);
			for (const el of inerted) el.removeAttribute('inert');
			if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
		},
	};
}
