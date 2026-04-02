const PREFIX = 'drawtabdata-colwidths-';

export function loadColumnWidths(entityType: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(PREFIX + entityType);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveColumnWidths(entityType: string, widths: Record<string, number>) {
  localStorage.setItem(PREFIX + entityType, JSON.stringify(widths));
}
