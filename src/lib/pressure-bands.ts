// Shared pressure-band definitions used by the Reference page and the
// Max Pressure tabs on pen / pen-family detail pages. Centralised so a
// threshold tweak only needs to happen in one place.
import type { Band } from '$lib/components/BandsChart.svelte';

/** IAF (Initial Activation Force) ranking bands in gram-force. Lower is
 * better — a lighter touch means more natural shading and less hand
 * fatigue. */
export const IAF_BANDS: Band[] = [
	{ min: 0, max: 1, label: 'EXCELLENT' },
	{ min: 1, max: 2, label: 'GREAT' },
	{ min: 2, max: 3.5, label: 'GOOD' },
	{ min: 3.5, max: 5, label: 'OK' },
	{ min: 5, max: null, label: 'AVOID' },
];

/** Max Physical Pressure ranking bands in gram-force. Higher = more
 * dynamic range before the pen saturates; too high = excessive arm
 * fatigue to reach full pressure. */
export const MAX_PRESSURE_BANDS: Band[] = [
	{ min: 100, max: 200, label: 'LIMITED' },
	{ min: 200, max: 350, label: 'OK' },
	{ min: 350, max: 500, label: 'GOOD' },
	{ min: 500, max: 900, label: 'EXCELLENT' },
	{ min: 900, max: null, label: 'EXCESSIVE' },
];
