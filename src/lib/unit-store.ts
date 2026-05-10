import { writable } from 'svelte/store';
import { type UnitPreference, loadUnitPreference, saveUnitPreference } from '$data/lib/units.js';
import { getStorageItem, setStorageItem } from './storage.js';

export const unitPreference = writable<UnitPreference>(loadUnitPreference());

export function toggleUnits() {
	unitPreference.update((current) => {
		const next: UnitPreference = current === 'metric' ? 'imperial' : 'metric';
		saveUnitPreference(next);
		return next;
	});
}

const ALT_UNITS_KEY = 'drawtabdata-show-alt-units';

function loadShowAltUnits(): boolean {
	const stored = getStorageItem(ALT_UNITS_KEY);
	return stored === null ? true : stored === 'true';
}

export const showAltUnits = writable<boolean>(loadShowAltUnits());

export function toggleAltUnits() {
	showAltUnits.update((current) => {
		const next = !current;
		setStorageItem(ALT_UNITS_KEY, String(next));
		return next;
	});
}
