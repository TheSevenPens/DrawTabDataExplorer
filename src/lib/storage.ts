// Single chokepoint for localStorage access. Reads return null/fallback
// silently — quota and private-browsing failures aren't actionable on
// reads. Writes log a console.warn so a failure leaves a breadcrumb the
// user can find when their setting "stops sticking".

export function getStorageItem(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

export function setStorageItem(key: string, value: string): boolean {
	try {
		localStorage.setItem(key, value);
		return true;
	} catch (err) {
		console.warn(`localStorage.setItem failed for key "${key}":`, err);
		return false;
	}
}

export function removeStorageItem(key: string): boolean {
	try {
		localStorage.removeItem(key);
		return true;
	} catch (err) {
		console.warn(`localStorage.removeItem failed for key "${key}":`, err);
		return false;
	}
}

export function getStorageJson<T>(key: string, fallback: T): T {
	const raw = getStorageItem(key);
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch (err) {
		console.warn(`localStorage JSON parse failed for key "${key}":`, err);
		return fallback;
	}
}

export function setStorageJson<T>(key: string, value: T): boolean {
	return setStorageItem(key, JSON.stringify(value));
}
