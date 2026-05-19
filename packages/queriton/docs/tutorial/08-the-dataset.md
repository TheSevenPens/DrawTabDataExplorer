# 8. The DataSet

In this chapter you'll meet `DataSet` — queriton's container for named collections. A DataSet groups related Queries together, memoises each one's loader, and gives you a uniform place to look them up.

## When you don't need it

A bare `Query<T>` is enough for one-off analyses. Construct it, chain verbs, materialise. The DataSet only earns its keep when you have multiple related collections that you want to (a) define once, (b) load lazily, and (c) reference from many call sites.

If your app touches one collection, skip this chapter and use `Query` directly.

## Registering collections

`registerCollection(name, loader, fields)` adds a Query to the DataSet and returns it. The loader is invoked at most once per DataSet instance — subsequent `.toArray()` calls reuse the cached Promise.

```ts run
const ds = new DataSet();
const penguinsCollection = ds.registerCollection<Penguin>(
	'penguins',
	async () => penguins,
	penguinFields,
);
const customersCollection = ds.registerCollection<Customer>(
	'customers',
	async () => customers,
	customerFields,
);

expect(ds.collectionNames()).toEqual(['penguins', 'customers']);
expect(await penguinsCollection.count()).toBe(344);
expect(await customersCollection.count()).toBe(4);
```

Things to notice:

- `registerCollection` returns the typed `Query<T>` — keep a reference if you want compile-time typing at call sites.
- The loader is **async** by design. It can read a file, fetch a URL, or query a backend. queriton doesn't care; it just awaits the Promise once.
- The DataSet does **not** load anything eagerly. Until you call a terminal method on one of the returned Queries, no I/O happens.

## Looking up by name

If you don't keep the typed reference around, `ds.get<T>(name)` retrieves it later — at the cost of having to pass the type parameter explicitly:

```ts run
const ds = new DataSet();
ds.registerCollection<Penguin>('penguins', async () => penguins, penguinFields);

const q = ds.get<Penguin>('penguins');
expect(await q.count()).toBe(344);
```

Trying to look up an unregistered name throws:

```ts run
const ds = new DataSet();
expect(() => ds.get('missing')).toThrow(/No collection named/);
```

## Memoised loading

This is the DataSet's most useful property. Each loader is invoked once. If multiple pipelines on the same collection materialise concurrently, they share the in-flight Promise — you don't pay the load cost twice.

```ts run
let loadCount = 0;
const ds = new DataSet();
ds.registerCollection<Penguin>(
	'penguins',
	async () => {
		loadCount++;
		return penguins;
	},
	penguinFields,
);

await Promise.all([
	ds.get<Penguin>('penguins').count(),
	ds.get<Penguin>('penguins').filter('species', '==', 'Adelie').count(),
	ds.get<Penguin>('penguins').sort('body_mass_g', 'desc').take(1).toArray(),
]);
expect(loadCount).toBe(1); // not 3 — the loader ran once and got reused
```

## Subclassing for typed accessors

The DataSet is designed to be subclassed. Apps that want typed properties — `ds.Penguins`, `ds.Customers` — rather than string-keyed lookups can wrap the registration in a constructor:

```ts run
class TutorialDataSet extends DataSet {
	readonly Penguins: Query<Penguin>;
	readonly Customers: Query<Customer>;
	constructor() {
		super();
		this.Penguins = this.registerCollection<Penguin>(
			'penguins',
			async () => penguins,
			penguinFields,
		);
		this.Customers = this.registerCollection<Customer>(
			'customers',
			async () => customers,
			customerFields,
		);
	}
}

const ds = new TutorialDataSet();
expect(await ds.Penguins.count()).toBe(344);
expect(await ds.Customers.count()).toBe(4);
```

This is the pattern the DrawTab project uses, and it scales well: each collection gets a typed property, the constructor is the one place where loader logic lives, and IDE autocomplete walks you through the available collections.

## What about getEntity / findBy / countBy?

Those are app-specific additions you'll find in DrawTab's `DrawTabDataSet`. They're built on top of queriton's `DataSet` and `Query` — `getEntity` is sugar for a cross-collection lookup; `findBy` and `countBy` are sugar on `Query`. queriton's base DataSet stays small on purpose; project-specific helpers belong in your subclass.

In the next chapter we'll look at what's inside those `fields` arrays you've been passing to every Query and DataSet call.
