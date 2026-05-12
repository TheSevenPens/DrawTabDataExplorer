// Hand-crafted two-table fixture for exercising all four join variants
// (inner, semi, anti, left) plus concat. Designed so each join produces
// a distinct, easy-to-eyeball result:
//
//   inner  → 4 rows (the 4 orders whose customerId matches a customer row)
//   semi   → 4 rows (same set, shape unchanged)
//   anti   → 2 rows (orders 105, 106 — customers C99, C00 don't exist)
//   left   → 6 rows (all orders; unmatched ones keep just the order fields)

import type { AnyFieldDef } from '../../src/index.js';

export interface Customer {
	customerId: string;
	name: string;
	country: string;
}

export interface Order {
	orderId: string;
	customerId: string;
	amount: number;
}

export const customers: Customer[] = [
	{ customerId: 'C01', name: 'Alice', country: 'US' },
	{ customerId: 'C02', name: 'Bob', country: 'UK' },
	{ customerId: 'C03', name: 'Carla', country: 'US' },
	{ customerId: 'C04', name: 'Dimitri', country: 'DE' },
];

export const orders: Order[] = [
	{ orderId: '101', customerId: 'C01', amount: 50 },
	{ orderId: '102', customerId: 'C02', amount: 75 },
	{ orderId: '103', customerId: 'C01', amount: 30 },
	{ orderId: '104', customerId: 'C04', amount: 120 },
	{ orderId: '105', customerId: 'C99', amount: 10 }, // unmatched
	{ orderId: '106', customerId: 'C00', amount: 200 }, // unmatched
];

function strField<T>(key: string): AnyFieldDef {
	return {
		key,
		label: key,
		type: 'string',
		group: 'data',
		getValue: (row: T) => {
			const v = (row as Record<string, unknown>)[key];
			return v == null ? '' : String(v);
		},
	};
}

function numField<T>(key: string): AnyFieldDef {
	return {
		key,
		label: key,
		type: 'number',
		group: 'data',
		getValue: (row: T) => {
			const v = (row as Record<string, unknown>)[key];
			return v == null ? '' : String(v);
		},
	};
}

export const customerFields: AnyFieldDef[] = [
	strField<Customer>('customerId'),
	strField<Customer>('name'),
	strField<Customer>('country'),
];

export const orderFields: AnyFieldDef[] = [
	strField<Order>('orderId'),
	strField<Order>('customerId'),
	numField<Order>('amount'),
];
