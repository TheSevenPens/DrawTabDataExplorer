# 6. Joins

In this chapter you'll combine rows from two Queries on a shared key. queriton has four join variants — inner, left, semi, anti — covering both "merge their columns" and "use the other side as a filter."

## The sample data

For this chapter we'll use two small fixtures:

**Customers** (4 rows):

| customerId | name    | country |
| ---------- | ------- | ------- |
| C01        | Alice   | US      |
| C02        | Bob     | UK      |
| C03        | Carla   | US      |
| C04        | Dimitri | DE      |

**Orders** (6 rows):

| orderId | customerId | amount |
| ------- | ---------- | ------ |
| 101     | C01        | 50     |
| 102     | C02        | 75     |
| 103     | C01        | 30     |
| 104     | C04        | 120    |
| 105     | C99        | 10     |
| 106     | C00        | 200    |

Notice that orders 105 and 106 reference customer ids that don't exist. This is deliberate — it lets every join variant produce a distinct, easy-to-eyeball result.

## Inner join

`.join(other, leftKey, rightKey)` keeps only rows that match on both sides and merges their columns.

```ts run
const matched = await ordersQ().join(customersQ(), 'customerId', 'customerId').toArray();
expect(matched).toHaveLength(4); // orders 101, 102, 103, 104 — the matched four
const first = matched[0] as Order & Customer;
expect(first.orderId).toBe('101');
expect(first.name).toBe('Alice'); // right-side columns merged in
expect(first.country).toBe('US');
```

Things to notice:

- The result's TypeScript type is `Order & Customer` — both column sets present.
- When a column name collides (here, `customerId`), the right side wins. Pick non-colliding keys or rename via `.derive()` upstream if that matters.

## Left join

`.leftjoin()` keeps every left row. Matched rows merge in the right side; unmatched ones pass through with the right-side columns missing.

```ts run
const all = await ordersQ().leftjoin(customersQ(), 'customerId', 'customerId').toArray();
expect(all).toHaveLength(6); // every order, matched or not

const unmatched = all.filter((r) => !(r as Order & Partial<Customer>).name);
expect(unmatched.map((r) => r.orderId).sort()).toEqual(['105', '106']);
```

The two unmatched orders are present, with no `name` or `country` columns.

## Semi join

`.semijoin()` keeps left rows that have at least one match on the right — but doesn't merge any right-side columns. Use it when the right side is acting as a filter.

```ts run
const real = await ordersQ().semijoin(customersQ(), 'customerId', 'customerId').toArray();
expect(real).toHaveLength(4);
// Row shape is still Order — no name/country merged in:
expect(Object.keys(real[0])).toEqual(['orderId', 'customerId', 'amount']);
```

> **From SQL:** semi join doesn't have direct syntax in standard SQL. The usual workaround is `WHERE EXISTS (SELECT 1 FROM right WHERE right.k = left.k)` or `WHERE left.k IN (SELECT k FROM right)`. queriton makes it a first-class verb because the "filter by another collection" pattern is extremely common.

## Anti join

`.antijoin()` is the inverse of semi: keeps left rows with **no** match on the right.

```ts run
const orphans = await ordersQ().antijoin(customersQ(), 'customerId', 'customerId').toArray();
expect(orphans.map((r) => r.orderId).sort()).toEqual(['105', '106']);
```

This is the verb for data-quality checks: "orders without a customer," "tablets with no compatibility entries," "pens not paired with any tablet."

## The null = null surprise

queriton's join key comparison goes through `getValue`, which means **null values match other null values**. This is the opposite of SQL, where any equality test involving NULL evaluates to UNKNOWN (so NULL = NULL is not true).

To see this clearly, build two tiny in-memory Queries with explicit nulls:

```ts run
type Row = { id: string; tag: string | null };
const leftRows: Row[] = [
	{ id: 'A', tag: 'x' },
	{ id: 'B', tag: null },
	{ id: 'C', tag: null },
];
const rightRows: Row[] = [
	{ id: 'X', tag: null },
	{ id: 'Y', tag: 'x' },
];
const rowFields = [
	{
		key: 'id',
		label: 'id',
		type: 'string' as const,
		getValue: (r: Row) => r.id,
	},
	{
		key: 'tag',
		label: 'tag',
		type: 'string' as const,
		getValue: (r: Row) => r.tag ?? '',
	},
];
const left = new Query<Row>(async () => leftRows, rowFields);
const right = new Query<Row>(async () => rightRows, rowFields);

const joined = await left.join(right, 'tag', 'tag').toArray();
// SQL would produce 1 row (A↔Y). queriton produces 3: A↔Y plus B↔X plus C↔X.
expect(joined).toHaveLength(3);
```

Things to notice:

- This is a **consequence of the getValue convention**, not a bug. Both sides' nulls become `""`, and `"" === ""` is true.
- If you don't want this, filter out the null keys before joining: `left.dropNulls('tag').join(right, 'tag', 'tag')`.
- The same caveat applies to `semijoin` and `antijoin`. An antijoin where the right side has any null keys will treat **all** null-keyed left rows as "matched" and drop them.

## A summary table

| Verb          | Keeps left rows that... | Merges right columns?       |
| ------------- | ----------------------- | --------------------------- |
| `.join()`     | match                   | yes                         |
| `.leftjoin()` | always                  | yes (partial for unmatched) |
| `.semijoin()` | match                   | no                          |
| `.antijoin()` | don't match             | no                          |

In the next chapter we'll cover concatenation — combining Queries vertically rather than horizontally.
