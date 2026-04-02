import { base } from '$app/paths';

export function buildFilterUrl(
  entityPath: string,
  filters: { field: string; operator: string; value: string }[],
): string {
  const params = new URLSearchParams();
  for (const f of filters) {
    params.append('filter', `${f.field}:${f.operator}:${f.value}`);
  }
  return `${base}${entityPath}?${params.toString()}`;
}

export function buildFilterUrlForValues(
  entityPath: string,
  field: string,
  values: string[],
): string {
  // For small lists, use individual equality filters
  // For the explorer to handle, we encode as a special "in" filter
  const params = new URLSearchParams();
  params.set('filterIn', `${field}:${values.join(',')}`);
  return `${base}${entityPath}?${params.toString()}`;
}
