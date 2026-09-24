import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusableWithin, modalBehavior, wrapTarget } from './modal-behavior.js';

function el(html: string): HTMLElement {
	const wrap = document.createElement('div');
	wrap.innerHTML = html.trim();
	return wrap.firstElementChild as HTMLElement;
}

describe('wrapTarget', () => {
	const [a, b, c] = ['a', 'b', 'c'].map(() => document.createElement('button'));
	const items = [a, b, c];

	it('wraps Tab from the last element to the first', () => {
		expect(wrapTarget(items, c, false)).toBe(a);
	});
	it('wraps Shift+Tab from the first element to the last', () => {
		expect(wrapTarget(items, a, true)).toBe(c);
	});
	it('leaves the middle alone (browser moves focus)', () => {
		expect(wrapTarget(items, b, false)).toBeNull();
		expect(wrapTarget(items, b, true)).toBeNull();
	});
	it('pulls focus from outside the list to an edge', () => {
		expect(wrapTarget(items, document.body, false)).toBe(a);
		expect(wrapTarget(items, document.body, true)).toBe(c);
	});
	it('does nothing when there is nothing to focus', () => {
		expect(wrapTarget([], null, false)).toBeNull();
	});
});

describe('focusableWithin', () => {
	it('skips disabled, hidden-input and tabindex=-1 elements', () => {
		const root = el(`<div>
			<button id="ok">x</button>
			<button disabled>x</button>
			<input type="hidden" />
			<input id="text" />
			<div tabindex="-1">x</div>
			<a href="#" id="link">x</a>
		</div>`);
		expect(focusableWithin(root).map((e) => e.id)).toEqual(['ok', 'text', 'link']);
	});
});

describe('modalBehavior', () => {
	let page: HTMLElement;
	let opener: HTMLButtonElement;
	let host: HTMLElement;
	let dialog: HTMLElement;

	beforeEach(() => {
		document.body.innerHTML = '';
		page = el('<main><button id="opener">open</button></main>');
		opener = page.querySelector('button')!;
		host = el(`<div class="backdrop"><div role="dialog" aria-modal="true" tabindex="-1">
			<button id="first">first</button><button id="last">last</button>
		</div></div>`);
		dialog = host.firstElementChild as HTMLElement;
		document.body.append(page, host);
		opener.focus();
	});
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('makes the page behind inert, and restores it on destroy', () => {
		const action = modalBehavior(dialog);
		expect(page.hasAttribute('inert')).toBe(true);
		expect(host.hasAttribute('inert')).toBe(false);
		action.destroy();
		expect(page.hasAttribute('inert')).toBe(false);
	});

	it('does not clear inert that was already set by someone else', () => {
		page.setAttribute('inert', '');
		modalBehavior(dialog).destroy();
		expect(page.hasAttribute('inert')).toBe(true);
	});

	it('wraps Tab from the last button back to the first', () => {
		const action = modalBehavior(dialog);
		dialog.querySelector<HTMLElement>('#last')!.focus();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
		expect(document.activeElement?.id).toBe('first');
		action.destroy();
	});

	it('calls onclose on Escape', () => {
		const onclose = vi.fn();
		const action = modalBehavior(dialog, { onclose });
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(onclose).toHaveBeenCalledOnce();
		action.destroy();
	});

	it('returns focus to the opener on destroy', () => {
		const action = modalBehavior(dialog);
		dialog.querySelector<HTMLElement>('#first')!.focus();
		action.destroy();
		expect(document.activeElement).toBe(opener);
	});
});
