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
	} catch {
		return false;
	}
}

export function removeStorageItem(key: string): boolean {
	try {
		localStorage.removeItem(key);
		return true;
	} catch {
		return false;
	}
}

export function getStorageJson<T>(key: string, fallback: T): T {
	const raw = getStorageItem(key);
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function setStorageJson<T>(key: string, value: T): boolean {
	return setStorageItem(key, JSON.stringify(value));
}
