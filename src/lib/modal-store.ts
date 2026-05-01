// Lightweight replacement for window.prompt() / window.confirm() that
// renders a styled, accessible Svelte dialog. Mount <ModalRoot /> once
// in +layout.svelte; call promptModal() or confirmModal() from anywhere
// and await the result.
//
// Returns:
//   promptModal()  -> Promise<string | null>  (null on cancel)
//   confirmModal() -> Promise<boolean>

import { writable } from 'svelte/store';

export interface PromptRequest {
	kind: 'prompt';
	title: string;
	defaultValue: string;
	confirmLabel: string;
	cancelLabel: string;
	resolve: (value: string | null) => void;
}

export interface ConfirmRequest {
	kind: 'confirm';
	title: string;
	body?: string;
	confirmLabel: string;
	cancelLabel: string;
	resolve: (value: boolean) => void;
}

export type ModalRequest = PromptRequest | ConfirmRequest;

export const modalRequest = writable<ModalRequest | null>(null);

export function promptModal(
	title: string,
	defaultValue = '',
	{ confirmLabel = 'OK', cancelLabel = 'Cancel' } = {},
): Promise<string | null> {
	return new Promise((resolve) => {
		modalRequest.set({ kind: 'prompt', title, defaultValue, confirmLabel, cancelLabel, resolve });
	});
}

export function confirmModal(
	title: string,
	body?: string,
	{ confirmLabel = 'OK', cancelLabel = 'Cancel' } = {},
): Promise<boolean> {
	return new Promise((resolve) => {
		modalRequest.set({ kind: 'confirm', title, body, confirmLabel, cancelLabel, resolve });
	});
}
