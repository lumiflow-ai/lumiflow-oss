import { assert, describe, expect, it } from "vitest";

import { ExpiringLeastRecentlyUsedCache } from "@/lib/cache";

describe("ExpiringLeastRecentlyUsedCache", () => {
  it("has expected defaults", async () => {
    const cache = new ExpiringLeastRecentlyUsedCache<string, string>();
    expect(cache.capacity).toEqual(100);
    expect(cache.maximumDuration).toEqual(600000);
  });

  it("can change defaults", async () => {
    const cache = new ExpiringLeastRecentlyUsedCache<string, string>();
    cache.capacity = 10;
    cache.maximumDuration = 1000;
    expect(cache.capacity).toEqual(10);
    expect(cache.maximumDuration).toEqual(1000);
  });

  it("loads items into cache", async () => {
    const now = new Date();
    const cache = new ExpiringLeastRecentlyUsedCache<string, string>();
    const item1 = await cache.itemForID({
      id: "1",
      now,
      resolver(id) {
        expect(id).toEqual("1");
        return "one";
      },
    });
    const item2 = await cache.itemForID({
      id: "2",
      now,
      async resolver(id) {
        expect(id).toEqual("2");
        return new Promise((resolve) => resolve("two"));
      },
    });
    const item3 = await cache.itemForID({
      id: "3",
      now,
      resolver(id) {
        expect(id).toEqual("3");
        return "three";
      },
    });
    expect(item1).toEqual("one");
    expect(item2).toEqual("two");
    expect(item3).toEqual("three");
    expect(cache.entries.size).toEqual(3);
  });

  it("loads same items from cache", async () => {
    const now = new Date();
    const cache = new ExpiringLeastRecentlyUsedCache<string, string>();
    const item1 = await cache.itemForID({
      id: "1",
      now,
      resolver(id) {
        expect(id).toEqual("1");
        return "one";
      },
    });
    expect(item1).toEqual("one");
    expect(cache.entries.size).toEqual(1);
    const item2 = await cache.itemForID({
      id: "1",
      now,
      resolver() {
        assert.fail("Should not be called");
      },
    });
    const item3 = await cache.itemForID({
      id: "1",
      now,
      resolver() {
        assert.fail("Should not be called");
      },
    });
    expect(item2).toEqual("one");
    expect(item3).toEqual("one");
    expect(cache.entries.size).toEqual(1);
  });

  it("loads competing items just once", async () => {
    const now = new Date();
    const cache = new ExpiringLeastRecentlyUsedCache<string, string>();
    let continuation: undefined | (() => void);
    const continuationPromise = new Promise<void>((resolve) => {
      continuation = resolve;
    });

    const item1Promise = cache.itemForID({
      id: "1",
      now,
      async resolver(id) {
        expect(id).toEqual("1");
        await continuationPromise;
        return "one";
      },
    });
    expect(cache.entries.size).toEqual(1);
    const item2Promise = cache.itemForID({
      id: "1",
      now,
      resolver() {
        assert.fail("Should not be called");
      },
    });
    expect(cache.entries.size).toEqual(1);
    continuation?.();
    expect(await item1Promise).toEqual("one");
    expect(await item2Promise).toEqual("one");
  });

  it("items from cache can be updated", async () => {
    const now = new Date();
    const cache = new ExpiringLeastRecentlyUsedCache<string, string>();
    const item1 = await cache.itemForID({
      id: "1",
      now,
      resolver(id) {
        expect(id).toEqual("1");
        return "one";
      },
    });
    expect(item1).toEqual("one");
    expect(cache.entries.size).toEqual(1);
    expect(cache.entries.get("1")?.timestamp).toEqual(now);

    cache.updateItemIfPresent({ id: "1", item: "two", now: new Date(now.getTime() + 10) });
    const item2 = await cache.itemForID({
      id: "1",
      now,
      resolver() {
        assert.fail("Should not be called");
      },
    });
    expect(item2).toEqual("two");
    expect(cache.entries.size).toEqual(1);
    expect(cache.entries.get("1")?.timestamp).toEqual(new Date(now.getTime() + 10));

    cache.updateItemIfPresent({ id: "10", item: "ten", now: new Date(now.getTime() + 10) });
    expect(cache.entries.size).toEqual(1);
    expect(cache.entries.get("1")?.timestamp).toEqual(new Date(now.getTime() + 10));
    expect(cache.entries.get("1")?.result.item).toEqual("two");

    cache.invalidateItemWithID("1");
    expect(cache.entries.size).toEqual(0);
  });

  it("loads up to capacity", async () => {
    const now = new Date();
    const cache = new ExpiringLeastRecentlyUsedCache<string, string>();
    cache.capacity = 10;

    /// The first 10 accesses should all be called.
    let callCount = 0;
    for (let index = 0; index < 10; index += 1) {
      const item = await cache.itemForID({
        id: `${index}`,
        now,
        resolver(id) {
          callCount += 1;
          expect(id).toEqual(`${index}`);
          return `${index} ${index}`;
        },
      });
      expect(item).toEqual(`${index} ${index}`);
      expect(cache.entries.size).toEqual(index + 1);
    }
    expect(callCount).toEqual(10);
    expect(cache.entries.size).toEqual(10);

    /// Verify the first item has an expected value.
    const firstItem = await cache.itemForID({
      id: "0",
      now,
      resolver() {
        assert.fail("Should not be called");
      },
    });
    expect(firstItem).toEqual("0 0");
    expect(cache.entries.size).toEqual(10);

    /// The next 10 accesses should be from cache.
    for (let index = 0; index < 10; index += 1) {
      const item = await cache.itemForID({
        id: `${index}`,
        now,
        resolver() {
          assert.fail("Should not be called");
        },
      });
      expect(item).toEqual(`${index} ${index}`);
      expect(cache.entries.size).toEqual(10);
    }

    /// The next new item should be accessed, and should kick off the oldest entry
    const newItem = await cache.itemForID({
      id: "New",
      now,
      resolver(id) {
        expect(id).toEqual("New");
        return "NEW";
      },
    });
    expect(newItem).toEqual("NEW");
    expect(cache.entries.size).toEqual(10);

    /// The next 9 accesses should be from cache.
    for (let index = 1; index < 10; index += 1) {
      const item = await cache.itemForID({
        id: `${index}`,
        now,
        resolver() {
          assert.fail("Should not be called");
        },
      });
      expect(item).toEqual(`${index} ${index}`);
      expect(cache.entries.size).toEqual(10);
    }

    /// This one, however, was evicted and needs to be re-loaded.
    const oldItem = await cache.itemForID({
      id: "0",
      now,
      resolver(id) {
        expect(id).toEqual("0");
        return "0 0 - new";
      },
    });
    expect(oldItem).not.toEqual(firstItem);
    expect(oldItem).toEqual("0 0 - new");
    expect(cache.entries.size).toEqual(10);
  });

  it("expires old items", async () => {
    const now = new Date();
    const cache = new ExpiringLeastRecentlyUsedCache<string, string>();
    cache.capacity = 10;
    cache.maximumDuration = 100;

    /// The first 10 accesses should all be called.
    let callCount = 0;
    for (let index = 0; index < 10; index += 1) {
      const item = await cache.itemForID({
        id: `${index}`,
        now: new Date(now.getTime() + index * 10),
        resolver(id) {
          callCount += 1;
          expect(id).toEqual(`${index}`);
          return `${index} ${index}`;
        },
      });
      expect(item).toEqual(`${index} ${index}`);
      expect(cache.entries.size).toEqual(index + 1);
    }
    expect(callCount).toEqual(10);
    expect(cache.entries.size).toEqual(10);

    const oldestItemBefore = await cache.itemForID({
      id: "0",
      now: new Date(now.getTime() + 100),
      resolver() {
        assert.fail("Should not be called");
      },
    });
    expect(oldestItemBefore).toEqual("0 0");
    expect(cache.entries.size).toEqual(10);

    /// The first item has just expired
    const oldestItemAfter = await cache.itemForID({
      id: "0",
      now: new Date(now.getTime() + 101),
      resolver(id) {
        callCount += 1;
        expect(id).toEqual("0");
        return "0 0 - new";
      },
    });
    expect(oldestItemAfter).toEqual("0 0 - new");
    expect(callCount).toEqual(11);
    expect(cache.entries.size).toEqual(10);

    /// All other items should have just expired
    const oldestItemLater = await cache.itemForID({
      id: "0",
      now: new Date(now.getTime() + 202),
      resolver(id) {
        callCount += 1;
        expect(id).toEqual("0");
        return "0 0 - later";
      },
    });
    expect(oldestItemLater).toEqual("0 0 - later");
    expect(callCount).toEqual(12);
    expect(cache.entries.size).toEqual(1);
  });
});
