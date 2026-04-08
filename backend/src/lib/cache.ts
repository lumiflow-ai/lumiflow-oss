type CacheEntry<ID, Item> = {
  id: ID;
  timestamp: Date;
  result: { kind: "resolved"; item: Item } | { kind: "loading"; item: Promise<Item> };
};

/** A time-aware, least-recently-used cache for storing identifiable items up to a given capacity. */
export class ExpiringLeastRecentlyUsedCache<ID, Item> {
  capacity = 100;
  maximumDuration: number = 10 * 60 * 1000;
  entries: Map<ID, CacheEntry<ID, Item>> = new Map();

  /** Load or resolve a cached item with a given ID. */
  async itemForID({
    id,
    now,
    resolver,
  }: {
    id: ID;
    now: Date;
    resolver: (id: ID) => Promise<Item> | Item;
  }): Promise<Item> {
    const existingEntry = this.entries.get(id);

    /// Check for a valid, non-expired entry first, and return that if available.
    if (existingEntry && now.getTime() - existingEntry.timestamp.getTime() <= this.maximumDuration) {
      /// Move the entry to the start of the cache.
      this.shiftEntry({ newEntry: existingEntry, now });

      /// Return the item or promise
      return existingEntry.result.item;
    }

    /// We don't have an item yet, so start resolving it.
    const itemOrPromise = resolver(id);

    /// If the result is not a promise, save it as is and stop here.
    if (!(itemOrPromise instanceof Promise)) {
      const item = itemOrPromise;
      const newEntry: CacheEntry<ID, Item> = {
        id,
        timestamp: now,
        result: { kind: "resolved", item },
      };
      this.shiftEntry({ newEntry, now });
      return item;
    }

    /// Otherwise, save the item as a promise immediately.
    const itemPromise = itemOrPromise;
    const newEntry: CacheEntry<ID, Item> = {
      id,
      timestamp: now,
      result: { kind: "loading", item: itemPromise },
    };
    this.shiftEntry({ newEntry, now });

    /// Wait for the item to load, and replace it in the cache if it is still in the loading state.
    const item = await itemPromise;
    if (newEntry.result.kind === "loading" && newEntry.result.item === itemPromise) {
      newEntry.result = { kind: "resolved", item };
    }
    this.shiftEntry({ newEntry, now });

    return item;
  }

  /** Replace the item in the cache with an up-to-date version, resetting the expiration date accordingly. */
  updateItemIfPresent({ id, item, now }: { id: ID; item: Item; now: Date }) {
    const existingEntry = this.entries.get(id);
    if (!existingEntry) return;
    existingEntry.result = { kind: "resolved", item };
    existingEntry.timestamp = now;
  }

  /** Instantly invalidate the cache entry for the specified ID. */
  invalidateItemWithID(id: ID) {
    this.entries.delete(id);
  }

  /** Add the following entry to the front of the cache, and drop any entries that exceed the capacity of the cache. */
  private shiftEntry({ newEntry, now }: { newEntry: CacheEntry<ID, Item>; now: Date }) {
    const entries: [ID, CacheEntry<ID, Item>][] = [[newEntry.id, newEntry]];
    for (const [id, entry] of this.entries) {
      /// Skip the entry we just moved to the front.
      if (id === newEntry.id) continue;

      /// Skip any expired entries.
      if (now.getTime() - entry.timestamp.getTime() > this.maximumDuration) continue;

      /// Add the entry as it passed all checks.
      entries.push([id, entry]);

      /// Stop checking for entries as we've reached capacity.
      if (entries.length >= this.capacity) break;
    }
    this.entries = new Map(entries);
  }
}
