// Array-column fixture for `.unroll()`. Covers the four shapes the
// engine has to handle:
//
//   - non-empty array        → one row per element
//   - empty array            → row is dropped
//   - null / missing value   → row passes through unchanged
//   - array with null member → null survives as its own emitted row

import type { AnyFieldDef } from '../../src/index.js';

export interface Person {
	name: string;
	hobbies: string[] | null;
}

export const people: Person[] = [
	{ name: 'Alice', hobbies: ['climbing', 'coding', 'tea'] },
	{ name: 'Bob', hobbies: ['climbing', 'biking'] },
	{ name: 'Charlie', hobbies: [] },
	{ name: 'Dana', hobbies: ['coding'] },
	{ name: 'Eve', hobbies: null },
];

export const peopleFields: AnyFieldDef[] = [
	{
		key: 'name',
		label: 'Name',
		type: 'string',
		group: 'data',
		getValue: (row: Person) => row.name,
	},
	{
		key: 'hobbies',
		label: 'Hobbies',
		type: 'string',
		group: 'data',
		// After .unroll() the column contains a scalar — until then the
		// FieldDef just reports its presence. Tests don't read it pre-unroll.
		getValue: (row: Person) => (Array.isArray(row.hobbies) ? row.hobbies.join(',') : ''),
	},
];
