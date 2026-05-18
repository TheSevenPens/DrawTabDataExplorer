import type { Tablet } from '$data/lib/drawtab-loader.js';
import { aspectRatioCategory, ASPECT_RATIO_CATEGORIES } from '$data/lib/aspect-ratio.js';

function gcd(a: number, b: number): number {
	return b === 0 ? a : gcd(b, a % b);
}

export function aspectRatioLabel(w: number, h: number): string {
	const lw = Math.max(w, h);
	const lh = Math.min(w, h);
	const scale = gcd(Math.round(lw), Math.round(lh));
	const rw = Math.round(lw / scale);
	const rh = Math.round(lh / scale);
	const ratio = lw / lh;
	if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
	if (Math.abs(ratio - 16 / 10) < 0.02) return '16:10';
	if (Math.abs(ratio - 4 / 3) < 0.02) return '4:3';
	if (Math.abs(ratio - 3 / 2) < 0.02) return '3:2';
	if (Math.abs(ratio - 5 / 4) < 0.02) return '5:4';
	return `${rw}:${rh}`;
}

export function ratio16(label: string): string {
	const [w, h] = label.split(':').map(Number);
	if (!w || !h) return '';
	const x = (h / w) * 16;
	const rounded = Math.round(x * 100) / 100;
	const display = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2).replace(/\.?0+$/, '');
	return `16:${display}`;
}

export function ratioDecimal(label: string): string {
	const [w, h] = label.split(':').map(Number);
	if (!w || !h) return '';
	return (w / h).toFixed(2);
}

export function labelToCategory(label: string): string {
	const [w, h] = label.split(':').map(Number);
	if (!w || !h) return '';
	return aspectRatioCategory(w, h) ?? '';
}

export function countBy<T>(
	items: T[],
	key: (item: T) => string,
): { label: string; count: number }[] {
	const map = new Map<string, number>();
	for (const item of items) {
		const k = key(item);
		map.set(k, (map.get(k) ?? 0) + 1);
	}
	return [...map.entries()]
		.map(([label, count]) => ({ label, count }))
		.sort((a, b) => b.count - a.count);
}

export function arRows(tablets: Tablet[]) {
	return countBy(
		tablets.filter(
			(t) => t.Digitizer?.Dimensions?.Width != null && t.Digitizer?.Dimensions?.Height != null,
		),
		(t) => aspectRatioLabel(t.Digitizer!.Dimensions!.Width!, t.Digitizer!.Dimensions!.Height!),
	).map((r) => ({
		...r,
		ratio16: ratio16(r.label),
		decimal: ratioDecimal(r.label),
		category: labelToCategory(r.label),
	}));
}

export function arCategoryRows(tablets: Tablet[]) {
	const counts = new Map<string, number>();
	for (const t of tablets) {
		const d = t.Digitizer?.Dimensions;
		const cat = aspectRatioCategory(d?.Width, d?.Height);
		if (cat == null) continue;
		counts.set(cat, (counts.get(cat) ?? 0) + 1);
	}
	return ASPECT_RATIO_CATEGORIES.filter((c) => counts.has(c)).map((c) => ({
		label: c,
		count: counts.get(c)!,
	}));
}

export function withinYears(t: Tablet, n: number | null): boolean {
	if (n === null) return true;
	const y = parseInt(t.Model.LaunchYear, 10);
	if (isNaN(y)) return false;
	return y >= new Date().getFullYear() - n;
}

export function subtitleFor(tablets: Tablet[]): string {
	const n = tablets.length;
	const noun = n === 1 ? 'tablet' : 'tablets';
	if (n === 0) return `0 ${noun}`;
	const ys = tablets.map((t) => parseInt(t.Model.LaunchYear, 10)).filter((y) => !isNaN(y));
	if (ys.length === 0) return `${n} ${noun}`;
	const min = Math.min(...ys);
	const max = Math.max(...ys);
	const range = min === max ? `${min}` : `${min}–${max}`;
	return `${n} ${noun} · ${range}`;
}

export function pct(n: number, total: number): string {
	return total === 0 ? '0.0%' : `${((n / total) * 100).toFixed(1)}%`;
}

export function filterByYears(
	tablets: Tablet[],
	type: 'PENTABLET' | 'PENDISPLAY',
	years: number | null,
): Tablet[] {
	return tablets.filter((t) => {
		if (type === 'PENTABLET' && t.Model.Type !== 'PENTABLET') return false;
		if (type === 'PENDISPLAY' && t.Model.Type === 'PENTABLET') return false;
		return withinYears(t, years);
	});
}
